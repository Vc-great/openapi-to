import isChinese from "is-chinese";
import _ from "lodash";
import { isRef } from "oas/types";
import { findSchemaDefinition } from "oas/utils";
import { pinyin } from "pinyin-pro";

import { Component } from "./Component.ts";
import { Parameter } from "./Parameter.ts";
import { RequestBody } from "./RequestBody.ts";
import { Response } from "./Response.ts";
import { Schema } from "./Schema.ts";

import type Oas from "oas";
import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { HttpMethod, PathGroup, PathGroupByTag } from "../types";

const enum WriteModel {
  await = "await",
  succeed = "succeed",
}

type RefCacheValue = {
  schema?: SchemaObject;
  type?: "";
  isWriteIndex?: boolean;
  //等待写入 写入完成
  writeModel?: `${WriteModel}`;
};

export class OpenAPI {
  public parameter: Parameter | undefined;
  public requestBody: RequestBody | undefined;
  public response: Response | undefined;
  public component: Component = new Component(this);
  public schema: Schema | undefined;
  public operation: Operation | undefined;
  public currentTagMetadata: OpenAPIV3.TagObject | undefined;
  public refCache: Map<string, RefCacheValue | null> = new Map<
    string,
    RefCacheValue | null
  >();
  public methodNameMap: Map<string, string> = new Map<string, string>();

  constructor(
    public config: object,
    public oas: Oas,
    public isFromPlugins: boolean = true,
  ) {
    this.config = config;
    this.oas = oas;
    this.isFromPlugins = isFromPlugins;

    if (isFromPlugins) {
      this.setMethodNameForPath();
    }
  }

  get currentTagName() {
    return _.camelCase(this.currentTagMetadata && this.currentTagMetadata.name);
  }

  get upperFirstCurrentTagName(): string {
    return _.upperFirst(this.currentTagName);
  }

  //file name and class name
  get operationName(): string {
    return "";
  }
  get methodName(): string {
    if (!this.operation?.path) {
      return "";
    }
    const key = this.operation.path + "_" + this.operation.method;
    return this.methodNameMap.get(key) || "";
  }

  //crud的requestName
  get requestName(): string {
    return _.camelCase(this.methodName);
  }

  get operationId(): string {
    return this.operation?.getOperationId() || "";
  }
  get upperFirstRequestName(): string {
    return _.upperFirst(this.methodName);
  }

  get errorResponseTypeName(): string {
    return this.upperFirstRequestName + "Error";
  }

  get queryRequestName(): string {
    return `${_.camelCase(this.methodName)}QueryParams`;
  }

  get upperFirstQueryRequestName(): string {
    return `${_.upperFirst(_.camelCase(this.methodName))}QueryParams`;
  }

  get pathRequestName(): string {
    return `${_.camelCase(this.methodName)}PathParams`;
  }

  get upperFirstPathRequestName(): string {
    return `${_.upperFirst(_.camelCase(this.methodName))}PathParams`;
  }

  get bodyDataName(): string {
    return `${_.camelCase(this.methodName)}MutationRequest`;
  }

  get upperFirstBodyDataName(): string {
    return `${_.upperFirst(_.camelCase(this.methodName))}MutationRequest`;
  }

  get responseTypeName(): string {
    return this.operation?.method === "get" ? "Query" : "Mutation";
  }

  get responseName(): string {
    return `${_.camelCase(this.methodName)}${this.responseTypeName}Response`;
  }

  get upperFirstResponseName(): string {
    return `${_.upperFirst(_.camelCase(this.methodName))}${this.responseTypeName}Response`;
  }

  get queryRequestNameForLowerFirst(): string {
    return _.lowerFirst(this.queryRequestName);
  }

  get pathRequestNameForLowerFirst(): string {
    return _.lowerFirst(this.pathRequestName);
  }

  get bodyRequestNameForLowerFirst(): string {
    return _.lowerFirst(this.bodyDataName);
  }

  get responseNameForLowFirst(): string {
    return _.lowerFirst(this.responseName);
  }

  get permissions(): Array<string> | undefined {
    return this.operation?.schema["x-permissions"] as Array<string> | undefined;
  }

  get pathGroupByTag(): PathGroupByTag {
    return _.chain(this.oas.getPaths())
      .map((item) => _.map(item))
      .flatten()
      .map(({ path, method, schema }) => {
        return _.map(schema.tags, (tag) => {
          return {
            path,
            method,
            tag,
          };
        });
      })
      .flatten()
      .groupBy("tag")
      .value();
  }

  setMethodNameForPath(): void {
    const openapi = new OpenAPI({}, this.oas, false);
    _.forEach(this.pathGroupByTag, (pathGroup, tag) => {
      const nameCount = new Map<string, number>();
      const nameSet = new Set<string>();
      _.forEach(pathGroup, ({ path, method, tag }) => {
        openapi.setCurrentOperation(path, method, tag);
        const currentName = openapi.generateMethodName();
        const key = openapi.operation?.path + "_" + openapi.operation?.method;
        if (nameSet.has(currentName)) {
          const num = nameCount.get(currentName) || 0;
          const name = currentName + (num + 1);

          this.methodNameMap.set(key, name);
          nameSet.add(currentName);
        } else {
          nameSet.add(currentName);
          this.methodNameMap.set(key, currentName);
        }
      });
    });
  }

  setCurrentOperation(
    path: string,
    method: HttpMethod,
    tagName: string,
  ): Operation {
    this.operation = this.oas.operation(path, method);
    //
    this.currentTagMetadata = this.operation
      .getTags()
      .find((tag) => tag.name === tagName);
    //
    this.parameter = new Parameter(this.operation);
    this.requestBody = new RequestBody(this.operation, this);
    this.response = new Response(this.operation, this);
    this.schema = new Schema(this.operation, this);
    return this.operation;
  }

  private generateMethodName(): string {
    if (!this.currentTagMetadata || !this.operation) {
      //todo error log
      return "";
    }
    const tag = this.currentTagMetadata.name;
    const pathGroup = this.pathGroupByTag;
    const crudPath = this.getCrudRequestPath(pathGroup[tag]);
    const methodUpperCase = this.operation.method.toUpperCase();

    //todo
    const currentPath = this.operation.path;
    const lasePathParams = this.getPathLastParams(currentPath);
    const name = new Map([
      ["GET", "findAll"],
      ["POST", "create"],
      ["PUT", "update"],
      ["DELETE", "remove"],
      ["PATCH", "patch"],
      ["DETAIL", "find"],
    ]);

    const isMatch = currentPath === crudPath && name.has(methodUpperCase);

    if (isMatch) {
      return name.get(methodUpperCase) || "";
    }

    //单个删除
    if (methodUpperCase === "DELETE" && lasePathParams) {
      return `delBy${_.upperFirst(_.camelCase(lasePathParams))}`;
    }

    const paths = currentPath.split("/").filter((x) => x);
    const hasBracket = _.last(paths)?.includes("{") || false;

    const detailPath = currentPath.replace(/\/{([^/]+)}/g, "");

    const isDetail = detailPath === crudPath && methodUpperCase === "GET";

    //detail
    if (hasBracket && isDetail) {
      return name.get("DETAIL") + "By" + lasePathParams;
    }
    //其他带括号
    if (hasBracket) {
      const popItem = _.last(paths) || "";

      return (
        _.camelCase(popItem.slice(1, popItem.length - 1)) +
        _.upperFirst(this.operation.method)
      );
    }

    return (
      _.camelCase(paths[paths.length - 1]) + _.upperFirst(this.operation.method)
    );
  }

  //最短路径为crud路径
  public getCrudRequestPath(list: Array<PathGroup> | undefined): string {
    if (list === undefined) {
      return "";
    }
    const obj = {
      path: "",
      length: Number.MAX_SAFE_INTEGER,
    };
    list.forEach((item) => {
      const paths = item.path.split("/").filter((x) => x);
      if (paths.length < obj.length) {
        obj.length = paths.length;
        obj.path = item.path;
      }
    });
    return obj.path;
  }

  //获取路径中最后一个参数
  getPathLastParams(path: string): string {
    const pathParts = path.split("/");

    const part = _.last(pathParts) || "";
    if (part.startsWith("{") && part.endsWith("}")) {
      return _.upperFirst(_.camelCase(part.slice(1, -1)));
    } else {
      return part;
    }
  }

  /**
   * @param check Data to determine if it contains a ReferenceObject (`$ref` pointer`).
   * @returns If the supplied data has a `$ref` pointer.
   */
  isReference(
    check: unknown,
  ): check is OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject {
    return isRef(check);
  }

  resetRefCache(): void {
    this.refCache.clear();
  }

  getRefAlias($ref: string): string {
    //todo ref cache
    this.refCache.set($ref, null);
    const typeName = $ref.replace(/.+\//, "");
    const text = isChinese(typeName)
      ? pinyin(typeName, { toneType: "none", type: "array" }).join()
      : typeName;
    return _.camelCase(text);
  }

  getDomainNameByRef($ref: string): string {
    return $ref.replace(/.+\//, "");
  }

  hasRefByCache($ref: string): boolean {
    return [...this.refCache.keys()].includes($ref);
  }

  setRefCache(ref: string, config: RefCacheValue): void {
    const value = this.refCache.get(ref);
    this.refCache.set(ref, {
      ...value,
      ...config,
    });
  }

  /**
   * Lookup a reference pointer within an OpenAPI definition and return the schema that it resolves
   * to.
   *
   * @param $ref Reference to look up a schema for.
   */
  findSchemaBy$ref($ref: string): any {
    const schema = findSchemaDefinition(
      $ref,
      this.operation?.api,
    ) as SchemaObject;

    this.refCache.set($ref, {
      schema: schema,
      writeModel: "await",
    });
    return schema;
  }

  findSchemaDefinition($ref: string): unknown {
    return findSchemaDefinition($ref, this.operation?.api);
  }

  formatterSchemaType(type: string | undefined): string {
    const numberEnum = [
      "int32",
      "int64",
      "float",
      "double",
      "integer",
      "long",
      "number",
      "int",
    ];

    const stringEnum = ["string", "email", "password", "url", "byte", "binary"];
    // const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

    if (typeof type !== "string") {
      return "unknown";
    }

    if (numberEnum.includes(type)) {
      return "number";
    }

    /*   if (dateEnum.includes(type)) {
      return "Date";
    }*/

    if (stringEnum.includes(type || "")) {
      return "string";
    }

    if (type === "boolean") {
      return "boolean";
    }
    return type;
  }
}
