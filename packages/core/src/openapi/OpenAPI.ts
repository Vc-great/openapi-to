import _ from "lodash";

import { Parameter } from "./Parameter.ts";
import { RequestBody } from "./RequestBody.ts";
import { Response } from "./Response.ts";

import type Oas from "oas";
import type { Operation } from "oas/operation";
import type { OpenAPIV3 } from "openapi-types";
import type { HttpMethod, PathGroup, PathGroupByTag } from "../types.js";

export class OpenAPI {
  public parameter: Parameter | undefined;
  public requestBody: RequestBody | undefined;
  public response: Response | undefined;
  public operation: Operation | undefined;
  public currentTagMetadata: OpenAPIV3.TagObject | undefined;

  constructor(
    public config: object,
    public oas: Oas,
  ) {
    this.config = config;
    this.oas = oas;
  }

  //file name and class name
  get operationName(): string {
    return "";
  }

  //crud的requestName
  get requestName(): string {
    return this.generateRequestName();
  }

  get queryRequestName(): string {
    return `${_.upperFirst(_.camelCase(this.requestName))}QueryRequest`;
  }

  get pathRequestName(): string {
    return `${_.upperFirst(_.camelCase(this.requestName))}PathRequest`;
  }

  get bodyRequestName(): string {
    return `${_.upperFirst(_.camelCase(this.requestName))}BodyRequest`;
  }

  get responseName(): string {
    return `${_.upperFirst(_.camelCase(this.requestName))}Response`;
  }

  get queryRequestNameForLowerFirst(): string {
    return _.lowerFirst(this.queryRequestName);
  }

  get pathRequestNameForLowerFirst(): string {
    return _.lowerFirst(this.pathRequestName);
  }

  get bodyRequestNameForLowerFirst(): string {
    return _.lowerFirst(this.bodyRequestName);
  }

  get responseNameForLowFirst(): string {
    return _.lowerFirst(this.responseName);
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
    this.requestBody = new RequestBody(this.operation);
    this.response = new Response(this.operation);
    return this.operation;
  }

  private generateRequestName(): string {
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

      return _.camelCase(popItem.slice(1, popItem.length - 1));
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
}
