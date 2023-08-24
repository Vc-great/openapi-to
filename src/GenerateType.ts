import _ from "lodash";
import fse from "fs-extra";
import type {
  ApiData,
  Config,
  GenerateCode,
  OpenApi3FormatData,
} from "./types";
import {
  BaseType,
  getResponseRef,
  prettierFile,
  formatterBaseType,
} from "./utils";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import { errorLog, successLog } from "./log";

export class GenerateType implements GenerateCode {
  pendingRefCache: Set<string>;
  resolveRefCache: Set<string>;
  apiNameCache: Map<string, string>;
  enumSchema: Map<string, object>;
  constructor(
    public config: Config,
    public openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;

    //缓存$ref
    this.pendingRefCache = new Set();
    //已解析过的ref
    this.resolveRefCache = new Set();
    //缓存apiName
    this.apiNameCache = new Map();
    this.enumSchema = new Map();
    this.config = config;
  }

  //query参数
  getQueryParamsType(apiItem: ApiData) {
    const query = _.filter(apiItem.parameters, ["in", "query"]);
    if (_.isEmpty(query)) return "";

    return `/** ${apiItem.summary ?? ""}*/
    export interface ${_.upperFirst(apiItem.requestName)}QueryRequest {
                 ${this.handleParameters(query)}
            }`;
  }

  handleParameters(
    parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
  ) {
    const itemTypeMap = (
      parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
    ): string[] => {
      return _.map(parameters, (item) => {
        //todo 补充逻辑
        if ("$ref" in item) {
          return "";
        }
        //todo 补充$ref逻辑
        if (item.schema && "$ref" in item.schema) {
          console.log("-> handleParameters异常");
          return "";
        }

        return `/** ${item.description ?? ""} */
              ${item.name.includes("-") ? _.camelCase(item.name) : item.name}${
          item.required ? "" : "?"
        }:${formatterBaseType(item.schema)}`;
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    return _.flow(itemTypeMap, joinItem)(parameters);
  }
  //body参数
  getBodyParamsType(apiItem: ApiData) {
    if (!apiItem.requestBody) {
      return "";
    }
    const interfaceName = `${_.upperFirst(apiItem.requestName)}BodyRequest`;
    //已经解析过采用继承的方式
    if (
      "$ref" in apiItem.requestBody &&
      this.apiNameCache.has(apiItem.requestBody.$ref)
    ) {
      return `/** ${apiItem.summary ?? ""} */
      export interface ${interfaceName} extends ${this.apiNameCache.get(
        apiItem.requestBody.$ref
      )}{}`;
    }

    let component;

    if ("$ref" in apiItem.requestBody) {
      const [resolveComponent, resolveRefs] =
        this.getRequestBodiesComponentByRef(apiItem.requestBody.$ref);

      component = resolveComponent;
      [...resolveRefs, apiItem.requestBody.$ref].forEach((ref) =>
        this.apiNameCache.set(ref, interfaceName)
      );
    }

    if (
      !component &&
      "content" in apiItem.requestBody &&
      apiItem.requestBody.content
    ) {
      const media = _.chain(apiItem.requestBody.content)
        .values()
        .head()
        .value();

      if (media.schema && "$ref" in media.schema) {
        const [resolveComponent, resolveRefs] =
          this.getRequestBodiesComponentByRef(media.schema.$ref);
        component = resolveComponent;
        [...resolveRefs, media.schema.$ref].forEach((ref) =>
          this.apiNameCache.set(ref, interfaceName)
        );
      } else {
        component = media.schema;
      }
    }

    if (!component) {
      return "";
    }

    if (
      component.type === "array" &&
      component.items &&
      !("$ref" in component.items)
    ) {
      return `/** ${apiItem.summary} */
      export type ${interfaceName} = ${formatterBaseType(component.items)}[]`;
    }

    //容错 请求body不应该是基本类型
    if (BaseType.includes(component.type || "")) {
      return `/** ${apiItem.summary} */
            export type ${interfaceName} = ${formatterBaseType(component)}`;
    }

    const typeString = this.handleComponentSchema(component);

    const bodyType = `/** ${apiItem.summary ?? ""} */
            export interface ${interfaceName} {
              ${typeString}
            }`;
    return `${bodyType}`;
  }

  getRequestBodiesComponentByRef(
    ref: string = "",
    refsCache: Array<string> = []
  ): [undefined | OpenAPIV3.SchemaObject, string[]] {
    const schemaComponent = this.getComponentByRef(ref);

    if (schemaComponent === undefined) {
      return [undefined, refsCache];
    }

    if ("$ref" in schemaComponent) {
      return this.getRequestBodiesComponentByRef(schemaComponent.$ref, [
        ...refsCache,
        schemaComponent.$ref,
      ]);
    }

    if ("content" in schemaComponent) {
      const media = _.chain(schemaComponent.content).values().head().value();

      if (media.schema && "$ref" in media.schema) {
        return this.getRequestBodiesComponentByRef(media.schema.$ref, [
          ...refsCache,
          media.schema.$ref,
        ]);
      }

      if (
        media.schema &&
        media.schema.type === "array" &&
        "$ref" in media.schema.items
      ) {
        return this.getRequestBodiesComponentByRef(media.schema.items.$ref, [
          ...refsCache,
          media.schema.items.$ref,
        ]);
      }

      return [media.schema, refsCache];
    }
    return [schemaComponent, refsCache];
  }

  getComponentByRef(
    ref: string = "",
    isCache: boolean = true
  ):
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3.SchemaObject
    | undefined {
    //查看是否解析过,已经解析过直接return
    if (isCache && this.resolveRefCache.has(ref)) {
      return undefined;
    }
    //添加到已解析 用于去重
    isCache && this.resolveRefCache.add(ref);
    return _.get(
      this.openApi3SourceData,
      ref.split("/").slice(1).join("."),
      undefined
    );
  }
  //
  getComponentTypeByRef($refs: Array<string>, typeString: string = ""): string {
    this.pendingRefCache.clear();

    const generateInterface = (
      component: OpenAPIV3.SchemaObject | undefined,
      index: number
    ) => {
      if (!component) {
        return undefined;
      }
      const interfaceName = _.upperFirst($refs[index].split("/").pop());
      //没有properties
      if (component.type === "object" && !component.properties) {
        return `/**${component.title}*/
      export type ${interfaceName} = object`;
      }

      return `/**${component.title ?? ""}*/
      export  interface ${_.upperFirst(interfaceName)} {
              ${this.handleComponentSchema(component)}
             }`;
    };

    typeString +=
      (typeString ? "\n" : "") +
      _.chain($refs)
        .map((ref) => this.getComponentByRef(ref))
        .map((component: OpenAPIV3.SchemaObject | undefined, index) =>
          generateInterface(component, index)
        )
        .filter((component) => !!component)

        .join("\n");

    return this.pendingRefCache.size
      ? this.getComponentTypeByRef([...this.pendingRefCache.keys()], typeString)
      : typeString;
  }

  getResponseType(apiItem: ApiData) {
    const responseRef = getResponseRef(apiItem);
    const interfaceName = `${_.upperFirst(apiItem.requestName)}Response`;

    if (!responseRef) {
      return `/** ${apiItem.summary} */
           export  interface ${interfaceName} {}`;
    }

    //已经解析过采用继承的方式
    if (this.apiNameCache.has(responseRef)) {
      return `/** ${apiItem.summary} */
      export interface ${interfaceName} extends ${this.apiNameCache.get(
        responseRef
      )}{}`;
    }
    this.apiNameCache.set(responseRef, interfaceName);

    const component = this.getComponentByRef(
      responseRef
    ) as OpenAPIV3.SchemaObject;

    const typeString = this.handleComponentSchema(component);

    //
    const bodyTypeStr = `/** ${apiItem.summary} */
           export  interface ${interfaceName} {
              ${typeString}
            }`;
    return `${bodyTypeStr}`;
  }
  // 生成ts类型
  public run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.pendingRefCache.clear();
    this.resolveRefCache.clear();
    this.apiNameCache.clear();

    const tagItemTypeString = tagItem
      .map((apiItem) => {
        const types = [
          this.getQueryParamsType(apiItem),
          this.getBodyParamsType(apiItem),
          this.getResponseType(apiItem),
          this.getComponentTypeByRef([...this.pendingRefCache.keys()]),
        ];
        const filterEmpty = (types: string[]) => types.filter((type) => type);
        const addType = (types: string[]) => types.join("\n");

        return _.flow([filterEmpty, addType])(types);
      })
      .join("\n");

    const addEslint = (tagItemTypeString: string) => `
    //eslint-disable-next-line @typescript-eslint/no-namespace
    /**
     *@tagName ${_.get(tagItem, "[0].tags[0]", "")}
     *@description ${_.get(tagItem, "[0].tagDescription", "")}
     */
     //todo edit namespace name
    export namespace ApiType {
      /**error response*/
       export interface ErrorResponse {}
      ${tagItemTypeString}
  
    }
      ${this.getEnumOption(Array.from(this.enumSchema.entries()))}
    `;

    return {
      title: _.get(_.head(tagItem), "tags[0]", ""),
      codeString: prettierFile(addEslint(tagItemTypeString)),
    };
  }
  //this.enumSchema.entries(),
  getEnumOption(enumSchema: [string, OpenAPIV3.SchemaObject][]) {
    this.enumSchema.clear();
    //todo 解析     this.enumSchema 生成label option
    return _.reduce(
      enumSchema,
      (result, [key, value]) => {
        const labelName = `${_.upperFirst(_.camelCase(key))}Label`;
        const valueName = `${_.upperFirst(_.camelCase(key))}`;

        result += `
        /**${value.description}*/
        export const enum ${labelName} {
                ${value.enum?.map((item) => {
                  return `${item} = ''`;
                })}
          }`;

        result += `
          /**${value.description}*/
         export const enum ${valueName} {
                ${value.enum?.map((item) => {
                  return `${item} = '${item}'`;
                })}
          }`;

        result += `
         /**${value.description}*/
        export const ${_.upperFirst(_.camelCase(key))}Option = [
                ${value.enum?.map((item, index) => {
                  return `${
                    index === 0 ? "" : "\n"
                  }{label:${labelName}.${item},value:${valueName}.${item}}`;
                })}
          ]`;

        return result;
      },
      ""
    );
  }

  handleComponentSchema(
    schemaObject:
      | OpenAPIV3.SchemaObject
      | OpenAPIV3.ReferenceObject
      | undefined,
    key?: string,
    parent?: OpenAPIV3.SchemaObject
  ) {
    if (_.isNil(schemaObject)) return undefined;
    // 引用类型
    if ("$ref" in schemaObject) {
      this.pendingRefCache.add(schemaObject.$ref);

      const component = this.getComponentByRef(
        schemaObject.$ref,
        false
      ) as OpenAPIV3.SchemaObject;
      const componentName = schemaObject.$ref.split("/").pop();

      return `/**${component.title ?? ""}*/
      ${key}${parent?.required?.includes(key || "") ? "" : "?"}:${_.upperFirst(
        componentName
      )}${component.type === "array" ? "[]" : ""}`;
    }
    // 数组类型
    if (schemaObject.type === "array") {
      if ("$ref" in schemaObject.items) {
        this.pendingRefCache.add(schemaObject.items.$ref);

        const component = this.getComponentByRef(
          schemaObject.items.$ref,
          false
        ) as OpenAPIV3.SchemaObject;

        return `/**${component.title ?? ""}*/
        ${key}${parent?.required?.includes(key || "") ? "" : "?"}:${
          _.upperFirst(schemaObject.items.$ref.split("/").pop()) + "[]"
        }`;
      }

      return `/**${schemaObject.description ?? ""}*/
      ${key ?? ""}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject.items)}[]`;
    }

    // 对象类型 properties 不存在
    if (schemaObject.type === "object" && !schemaObject.properties) {
      return `/**${schemaObject.description ?? ""}*/
        ${key ?? ""}${
        parent?.required?.includes(key || "") ? "" : "?"
      }: object`;
    }

    // 对象类型
    if (schemaObject.type === "object") {
      return _.reduce(
        schemaObject.properties,
        (result, value, key) => {
          result +=
            (result ? "\n" : "") +
            this.handleComponentSchema(value, key, schemaObject);
          return result;
        },
        ""
      );
    }

    // 枚举类型
    if (key && schemaObject.enum) {
      this.enumSchema.set(key, schemaObject);

      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent?.required?.includes(key) ? "" : "?"
      }:${this.resolveEnumObject(schemaObject)}`;
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      //todo 待补充
      errorLog("TS interface schemaObject.allOf");
      return "";
    }

    //基本类型
    if (["integer", "number"].includes(schemaObject.type || "")) {
      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject)}`;
    }

    if (schemaObject.type === "string") {
      return `${this.getStringDescription(schemaObject)}
      ${key}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject)}`;
    }

    if (schemaObject.type === "boolean") {
      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject)}`;
    }
    errorLog("TS interface schemaObject.type");
    return "";
  }

  getStringDescription(schemaObject: OpenAPIV3.SchemaObject) {
    if (["date", "date-time"].includes(schemaObject.format || "")) {
      return `/**
      *@remark RFC 3339 yyyy-MM-dd HH:mm:ss
      *@description ${schemaObject.description ?? ""}
      */`;
    }

    if (schemaObject.format === "binary") {
      return `/**
      *@remark content transferred in binary (octet-stream)
      *@description ${schemaObject.description ?? ""}
      */`;
    }

    if (schemaObject.format === "byte") {
      return `/**
      *@remark content transferred with base64 encoding
      *@description ${schemaObject.description ?? ""}
      */`;
    }

    return `/**${schemaObject.description ?? ""}*/`;
  }
  resolveEnumObject(schemaObject: OpenAPIV3.SchemaObject) {
    return Array.isArray(schemaObject.enum)
      ? _.reduce(
          schemaObject.enum,
          (result, value, index) => {
            result += `'${value}'${
              schemaObject.enum?.length === index + 1 ? "" : "|"
            }`;
            return result;
          },
          ""
        )
      : "string";
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}Types.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} interface write succeeded!`);
  }
}
