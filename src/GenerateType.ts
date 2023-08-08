// @ts-nocheck
import _ from "lodash";
import fse from "fs-extra";
import type { ApiData, GenerateCode } from "@/types";
import { OpenApi3FormatData } from "@/types";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import { prettierFile } from "./utils";

export class GenerateType implements GenerateCode {
  pendingRefCache: Set<string>;
  resolveRefCache: Set<string>;
  apiNameCache: Map<string, string>;
  enumSchema: Map<string, object>;
  constructor(
    public config: object,
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

    return `/** ${apiItem.summary}*/
    export interface ${_.upperFirst(apiItem.requestName)}QueryRequest {
                 ${this.handleParameters(query)}
            }`;
  }
  //路径参数
  getPathParamsType(apiItem: ApiData) {
    const pathParams = _.filter(apiItem.parameters, ["in", "path"]);
    if (_.isEmpty(pathParams)) return "";

    return `/**
            *@名称 ${apiItem.summary}
            *@tag名称 ${_.get(apiItem, "tags[0]", "")}
            */
          export interface ${_.upperFirst(apiItem.requestName)}PathRequest {
                ${this.handleParameters(pathParams)}
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
        }:${this.formatterBaseType(item.schema)}`;
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
      return `/** ${apiItem.summary} */
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

    if (!component && apiItem.requestBody.content) {
      const media = _.chain(apiItem.requestBody.content)
        .values()
        .head()
        .value();

      if ("$ref" in media.schema) {
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
      !component.items.$ref
    ) {
      return `  /** ${apiItem.summary} */
      export type ${interfaceName} = ${this.formatterBaseType(
        component.items
      )}[]`;
    }

    const typeString = this.handleComponentSchema(component);

    const bodyType = `
            /** ${apiItem.summary} */
            export interface ${interfaceName} {
              ${typeString}
            }`;
    return `${bodyType}`;
  }

  getRequestBodiesComponentByRef(
    ref: string = "",
    refsCache = []
  ): undefined | OpenAPIV3.SchemaObject {
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

      if (media.schema.type === "array" && media.schema?.items?.$ref) {
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

    const generateInterface = (component, index) => {
      const interfaceName = _.upperFirst($refs[index].split("/").pop());
      //没有properties
      if (component.type === "object" && !component.properties) {
        return `/**${component.title}*/
      export type ${interfaceName} = object`;
      }

      return ` export  interface ${_.upperFirst(interfaceName)} {
              ${this.handleComponentSchema(component)}
             }`;
    };

    typeString +=
      (typeString ? "\n" : "") +
      _.chain($refs)
        .map((ref) => this.getComponentByRef(ref))
        .filter((component) => !!component)
        .map((component: OpenAPIV3.SchemaObject, index) =>
          generateInterface(component, index)
        )

        .join("\n");

    return this.pendingRefCache.size
      ? this.getComponentTypeByRef([...this.pendingRefCache.keys()], typeString)
      : typeString;
  }

  getResponseType(apiItem: ApiData) {
    let responses = _.values(_.get(apiItem, "responses", {}));

    let $ref = "";
    while (!$ref && !_.isEmpty(responses)) {
      const head = responses.shift();
      if (!head) {
        break;
      }

      if ("$ref" in head) {
        $ref = head.$ref;
        break;
      }
      //下一轮循环
      if (_.isEmpty(head.content)) {
        continue;
      }
      $ref = _.get(_.values(head.content)[0], "schema.$ref", "");
    }

    const interfaceName = `${_.upperFirst(apiItem.requestName)}Response`;

    if (!$ref) {
      return `
            /** ${apiItem.summary} */
           export  interface ${interfaceName} {}`;
    }

    //已经解析过采用继承的方式
    if (this.apiNameCache.has($ref)) {
      return `/** ${apiItem.summary} */
      export interface ${interfaceName} extends ${this.apiNameCache.get(
        $ref
      )}{}`;
    }
    this.apiNameCache.set($ref, interfaceName);

    const component = this.getComponentByRef($ref) as OpenAPIV3.SchemaObject;

    const typeString = this.handleComponentSchema(component);

    //
    const bodyTypeStr = `
            /** ${apiItem.summary} */
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
          this.getPathParamsType(apiItem),
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
     *@tag名称 ${_.get(tagItem, "[0].tags[0]", "")}
     *@Description ${_.get(tagItem, "[0].description", "")}
     */
     //todo edit namespace name
    export namespace ApiType {
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
  getEnumOption(enumSchema) {
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
                ${value.enum.map((item) => {
                  return `${item} = ''`;
                })}
          }`;

        result += `
          /**${value.description}*/
         export const enum ${valueName} {
                ${value.enum.map((item) => {
                  return `${item} = '${item}'`;
                })}
          }`;

        result += `
         /**${value.description}*/
        export const ${_.upperFirst(_.camelCase(key))}Option = [
                ${value.enum.map((item, index) => {
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
    schemaObject: OpenAPIV3.SchemaObject | undefined,
    key?: string,
    parent?: OpenAPIV3.SchemaObject
  ) {
    if (_.isNil(schemaObject)) return undefined;
    // 数组类型
    if (schemaObject.type === "array") {
      if ("$ref" in schemaObject.items) {
        this.pendingRefCache.add(schemaObject.items.$ref);

        const component = this.getComponentByRef(
          schemaObject.items.$ref,
          false
        );

        return `/**${component.title}*/
        ${key}${parent.required?.includes(key) ? "" : "?"}:${
          _.upperFirst(schemaObject.items.$ref.split("/").pop()) + "[]"
        }`;
      }

      return `/**${schemaObject.description ?? ""}*/
      ${key ?? ""}${
        parent?.required?.includes(key) ? "" : "?"
      }:${this.formatterBaseType(schemaObject.items)}[]`;
    }

    // 对象类型 properties 不存在
    if (schemaObject.type === "object" && !schemaObject.properties) {
      return `/**${schemaObject.description ?? ""}*/
        ${key ?? ""}${parent?.required?.includes(key) ? "" : "?"}: object`;
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
    // 引用类型
    if (schemaObject.$ref) {
      this.pendingRefCache.add(schemaObject.$ref);

      const component = this.getComponentByRef(schemaObject.$ref, false);
      const componentName = schemaObject.$ref.split("/").pop();

      return `/**${component.title}*/
      ${key}${parent.required?.includes(key) ? "" : "?"}:${_.upperFirst(
        componentName
      )}${component.type === "array" ? "[]" : ""}`;
    }
    // 枚举类型
    if (schemaObject.enum) {
      this.enumSchema.set(key, schemaObject);

      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent.required?.includes(key) ? "" : "?"
      }:${this.resolveEnumObject(schemaObject)}`;
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      //todo 待补充
    }

    //基本类型
    if (["integer", "number"].includes(schemaObject.type)) {
      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent.required?.includes(key) ? "" : "?"
      }:${this.formatterBaseType(schemaObject)}`;
    }

    if (schemaObject.type === "string") {
      return `${this.getStringDescription(schemaObject)}
      ${key}${
        parent.required?.includes(key) ? "" : "?"
      }:${this.formatterBaseType(schemaObject)}`;
    }

    if (schemaObject.type === "boolean") {
      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent.required?.includes(key) ? "" : "?"
      }:${this.formatterBaseType(schemaObject)}`;
    }
    console.log("-> 存在异常", schemaObject.type);
    return "";
  }

  getStringDescription(schemaObject: OpenAPIV3.SchemaObject) {
    if (["date", "date-time"].includes(schemaObject.format)) {
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

  formatterBaseType(schemaObject) {
    let type = schemaObject.type;
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

    //const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

    const stringEnum = ["string", "email", "password", "url", "byte", "binary"];

    if (numberEnum.includes(type) || numberEnum.includes(schemaObject.format)) {
      return "number";
    }

    /*   if (dateEnum.includes(type)) {
      return "Date";
    }*/

    if (stringEnum.includes(type)) {
      return "string";
    }

    if (type === "boolean") {
      return "boolean";
    }

    if (type === "array") {
      return `${schemaObject.items.type}[]`;
    }
  }

  resolveEnumObject(schemaObject: OpenAPIV3.SchemaObject) {
    return Array.isArray(schemaObject.enum)
      ? _.reduce(
          schemaObject.enum,
          (result, value, index) => {
            result += `'${value}'${
              schemaObject.enum.length === index + 1 ? "" : "|"
            }`;
            return result;
          },
          ""
        )
      : "string";
  }

  writeFile(title, codeString) {
    const filePath = path.join(this.config.output, `${title}Types.ts`);
    fse.outputFileSync(filePath, codeString);
  }
}
