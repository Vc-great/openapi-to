// @ts-nocheck
import type {
  ContentObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
} from "openapi3-ts";
import _ from "lodash";
import fs from "fs";
import path from "path";
import { numberEnum } from "./enum";
import prettier from "prettier";
//import { prettier as defaultPrettierOptions } from "@umijs/fabric";
//import ReservedDict from "reserved-words";
import type { ApiData, GenerateCode, Parameters } from "@/types";
import { OpenAPIV3 } from "openapi-types";
import { OpenApi3FormatData, SchemaComponent } from "@/types";
export interface APIDataType extends OperationObject {
  path: string;
  method: string;
  description: string;
}

export type TagAPIDataType = Record<string, APIDataType[]>;
// 类型声明过滤关键字
const resolveTypeName = (typeName: string) => {
  /*  if (ReservedDict.check(typeName)) {
    return `__openAPI__${typeName}`;
  }*/
  const typeLastName = typeName.split("/").pop().split(".").pop();

  const name = typeLastName
    .replace(/[-_ ](\w)/g, (_all, letter) => letter.toUpperCase())
    .replace(/[^\w^\s^\u4e00-\u9fa5]/gi, "");

  // 当model名称是number开头的时候，ts会报错。这种场景一般发生在后端定义的名称是中文
  if (name === "_" || /^\d+$/.test(name)) {
    // console.log('⚠️  models不能以number开头，原因可能是Model定义名称为中文, 建议联系后台修改');
    return `Pinyin_${name}`;
  }
  if (!/[\u3220-\uFA29]/.test(name) && !/^\d$/.test(name)) {
    return name;
  }
  const noBlankName = name.replace(/ +/g, "");
  return noBlankName;
  // return pinyin.convertToPinyin(noBlankName, '', true);
};

function getRefName(refObject: any): string {
  if (typeof refObject !== "object" || !refObject.$ref) {
    return refObject;
  }
  const refPaths = refObject.$ref.split("/");
  return resolveTypeName(refPaths[refPaths.length - 1]) as string;
}

const DEFAULT_SCHEMA: SchemaObject = {
  type: "object",
  properties: { id: { type: "number" } },
};

const prettierFile = (content: string): [string, boolean] => {
  let result = content;
  let hasError = false;
  try {
    //const prettier = require('prettier');
    result = prettier.format(content, {
      singleQuote: true,
      trailingComma: "all",
      printWidth: 100,
      parser: "typescript",
      ...defaultPrettierOptions,
    });
  } catch (error) {
    hasError = true;
  }
  return [result, hasError];
};

export class GenerateType implements GenerateCode {
  //openApi3SourceData: OpenAPIV3.Document;
  // openApi3FormatData:OpenApi3FormatData
  // protected openAPIData: object; //OpenAPIObject;
  // protected apiData: object; // TagAPIDataType = {};
  // protected components: object; //components
  currentTagTypeNameCache: Map<string, string>;
  refSchemaAllCache: Map<string, object>;
  protected config: {
    responseReturnIsArray: boolean;
  };
  constructor(
    public config,
    public openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;
    // this.apiData = apiData;
    // this.openAPIData = openAPIData;
    //  this.components = {};
    // 当前tag的type name缓存,用于去重
    this.currentTagTypeNameCache = new Map();
    //缓存ref 用于去重
    this.refSchemaAllCache = new Map();
    this.config = {};
  }

  //
  recursionType(schemaComponent: SchemaComponent | undefined) {
    if (schemaComponent === undefined) {
      return "";
    }
    let typeString = "";
    if (schemaComponent.type === "object") {
      typeString = _.reduce(
        schemaComponent.properties,
        (result, value, key) => {
          result += `\n/** ${value.description}*/
                  ${key}${
            schemaComponent.required?.includes(key) ? "" : "?"
          }:${this.getTypeContent(value)}`;
          return result;
        },
        ""
      );
    }

    // 缓存$ref  遍历后清空
    const refSchemaCache = new Map();

    const typeStrByComponent = (
      schemaComponent: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
      typeStr: string
    ) => {
      const str = _.reduce(
        schemaComponent,
        (
          result,
          value: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
          key
        ) => {
          if (_.isNil(value)) return result;

          const ref = value.$ref || value.items?.$ref || "";
          const refName = ref.split("/").slice(1).pop();
          const refComponent = _.get(
            this.openApi3SourceData.components,
            refName,
            undefined
          );

          //refComponent 没存过进行存储
          if (refComponent && !this.currentTagTypeNameCache.has(refName)) {
            const component = {
              description: value.description,
              key: value.name,
              typeName: refName,
              refComponent,
            };
            refSchemaCache.set(refName, component);
            this.currentTagTypeNameCache.set(refName, component);
          }

          const str = `/** ${value.description} */
                    ${value.name} : ${
            refName ? refName + this.refType(ref) : value.type
          }`;
          result += "\n" + str;
          return result;
        },
        typeStr
      );
      return str;
    };

    const typeStr = typeStrByComponent(schemaComponent, "");

    const nextRefSchema = (
      refSchemaMap: Map<string, OpenAPIV3.ComponentsObject>,
      typeStr
    ) => {
      //暂存
      const refSchemaObject = _.cloneDeep(
        Object.fromEntries(refSchemaMap.entries())
      );

      //清空
      refSchemaCache.clear();

      const refTypes = _.reduce(
        refSchemaObject,
        (result, value, refName) => {
          //typeStrByComponent会填充 refSchemaCache
          const typeStr = typeStrByComponent(value.refComponent, "");

          result += `\n/** ${value.description} */
                                   export  interface ${value.typeName} {
                                      ${typeStr}
                                    }`;
          return result;
        },
        typeStr
      );

      //refSchemaCache 存在 则递归
      if (refSchemaCache.size) {
        return nextRefSchema(refSchemaCache, refTypes);
      }
      return refTypes;
    };

    const refTypeStr = nextRefSchema(refSchemaCache, "");
    return {
      typeStr,
      refTypeStr,
    };
  }

  hanldeRequestBodies(component: OpenAPIV3.RequestBodyObject) {}
  //query参数
  getQueryParamsType(apiItem: ApiData) {
    const query = _.filter(apiItem.parameters, ["in", "query"]);
    if (_.isEmpty(query)) return "";

    return `/**
            *@名称 ${apiItem.summary}
            *@tag名称 ${_.get(apiItem, "tags[0]", "")}
            */
    export interface ${_.camelCase(apiItem.requestName)}QueryRequest {
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
          export  interface ${_.camelCase(apiItem.requestName)}PathRequest {
                ${this.handleParameters(pathParams)}
            }`;
  }

  handleParameters(parameters: OpenAPIV3.ParameterObject) {
    const itemTypeMap = (parameters: Parameters): string[] => {
      return _.map(parameters, (item) => {
        //todo 补充$ref逻辑
        if ("$ref" in item) return "";

        return `/** ${item.description} */
              ${item.name}${item.required ? "?" : ""}:${this.getTypeContent(
          item.schema
        )}`;
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    return _.flow(itemTypeMap, joinItem)(parameters);
  }
  //body参数
  getBodyParamsType(apiItem: ApiData) {
    const requestBodiesName =
      _.get(apiItem, "requestBody.$ref", "").split("/").pop() || "";
    // this.openApi3SourceData.components.requestBodies
    if (!requestBodiesName) {
      return "";
    }
    const schemaComponent:
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3.RequestBodyObject = _.chain(
      this.openApi3SourceData.components?.requestBodies
    )
      .get(requestBodiesName, undefined)
      .value();
    let component;
    if ("$ref" in schemaComponent) {
      //todo 补充逻辑
    } else {
      const media: OpenAPIV3.MediaTypeObject = _.chain(schemaComponent.content)
        .values()
        .head()
        .value();

      component =
        media.schema && "$ref" in media.schema
          ? _.get(
              this.openApi3SourceData,
              media.schema.$ref.split("/").slice(1).join("."),
              undefined
            )
          : media.schema || undefined;
    }

    const { typeStr, refTypeStr } = this.recursionType(component);

    const bodyType = `
            /** ${apiItem.summary} */
            export interface ${_.camelCase(apiItem.requestName)}BodyRequest {
              ${typeStr}
            }`;
    return `${bodyType} ${refTypeStr}`;
  }

  getResponseType(apiItem: ApiData, requestName) {
    let responses = _.values(_.get(apiItem, "responses", {}));
    if (_.isEmpty(responses)) {
      return "";
    }
    let ref = "";
    while (!ref && !_.isEmpty(responses)) {
      const head = responses.shift();
      //下一轮循环
      if (_.isEmpty(head.content)) {
        continue;
      }
      ref = _.get(_.values(head.content)[0], "schema.$ref", "");
    }

    const schemaComponent = _.get(
      this.openApi3SourceData.components,
      _.last(ref.split("/")),
      undefined
    );
    const { typeStr, refTypeStr } = this.recursionType(schemaComponent);
    //
    const bodyTypeStr = `
            /** ${apiItem.summary} */
           export  interface ${requestName}Response {
              ${typeStr}
            }`;
    return `${bodyTypeStr} ${refTypeStr}`;
  }
  // 生成ts类型
  public run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.currentTagTypeNameCache.clear();

    return tagItem.map((apiItem) => {
      const types = [
        this.getQueryParamsType(apiItem),
        this.getBodyParamsType(apiItem),
        this.getPathParamsType(apiItem, apiItem.requestName),
        this.getResponseType(apiItem, apiItem.requestName),
      ];
      const filterEmpty = (types) => types.filter((type) => type);
      const addType = (types) => types.join("\n");

      const addEslint = (typesStr: string) =>
        `// eslint-disable-next-line @typescript-eslint/no-namespace` +
        "\n" +
        typesStr;

      return _.flow(filterEmpty, addType, addEslint)(types);
    });
  }

  private refType(ref) {
    const refName = ref.split("/").slice(1).join(".");
    const refComponent = _.get(this.openAPIData, refName, {});
    const objectEnum = {
      object: "",
      array: "[]",
    };

    return objectEnum[refComponent.type] || "";
  }

  resolveObject(schemaObject: SchemaObject) {
    // console.log("-> schemaObject",schemaObject);
    // 引用类型
    if (schemaObject.$ref) {
      //   console.log("-> $ref");
      return this.resolveRefObject(schemaObject);
    }
    // 枚举类型
    if (schemaObject.enum) {
      //    console.log("-> enum");
      return this.resolveEnumObject(schemaObject);
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      //  console.log("-> allOf");
      return this.resolveAllOfObject(schemaObject);
    }
    // 对象类型
    if (schemaObject.properties) {
      // console.log("-> properties");
      return this.resolveProperties(schemaObject);
    }
    // 数组类型
    if (schemaObject.items && schemaObject.type === "array") {
      // console.log("-> items");
      return this.resolveArray(schemaObject);
    }
    return schemaObject;
  }

  resolveArray(schemaObject: SchemaObject) {
    if (schemaObject.items.$ref) {
      const refObj = schemaObject.items.$ref.split("/");
      return {
        type: `${refObj[refObj.length - 1]}[]`,
      };
    }
    // TODO: 这里需要解析出具体属性，但由于 parser 层还不确定，所以暂时先返回 any
    return "any[]";
  }

  resolveProperties(schemaObject: SchemaObject) {
    return {
      props: this.getProps(schemaObject),
    };
  }

  // 获取 TS 类型的属性列表
  getProps(schemaObject: SchemaObject) {
    const requiredPropKeys = schemaObject?.required ?? false;
    return schemaObject.properties
      ? Object.keys(schemaObject.properties).map((propName) => {
          const schema: SchemaObject =
            (schemaObject.properties && schemaObject.properties[propName]) ||
            DEFAULT_SCHEMA;

          return {
            ...schema,
            title: schemaObject.title,
            name: propName,
            type: getTypeContent(schema),
            description: [schema.title, schema.description]
              .filter((s) => s)
              .join(" "),
            // 如果没有 required 信息，默认全部是非必填
            required: requiredPropKeys
              ? requiredPropKeys.some((key) => key === propName)
              : false,
          };
        })
      : [];
  }
  resolveEnumObject(schemaObject: SchemaObject) {
    const enumArray = schemaObject.enum;

    let enumStr;
    switch (this.config.enumStyle) {
      case "enum":
        enumStr = `{${enumArray.map((v) => `${v}="${v}"`).join(",")}}`;
        break;
      case "string-literal":
        enumStr = Array.from(
          new Set(
            enumArray.map((v) =>
              typeof v === "string"
                ? `"${v.replace(/"/g, '"')}"`
                : getTypeContent(v)
            )
          )
        ).join(" | ");
        break;
      default:
        break;
    }

    return {
      isEnum: this.config.enumStyle == "enum",
      type: Array.isArray(enumArray) ? enumStr : "string",
    };
  }

  resolveAllOfObject(schemaObject: SchemaObject) {
    const props = (schemaObject.allOf || []).map((item) =>
      item.$ref
        ? [{ ...item, type: this.getTypeContent(item).split("/").pop() }]
        : this.getProps(item)
    );
    return { props };
  }

  getTypeContent(
    schemaObject: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  ): string {
    if (_.isNil(schemaObject)) return "any";

    if (!_.isObject(schemaObject)) return schemaObject;

    if ("$ref" in schemaObject) {
      const result = [getRefName(schemaObject)].filter((s) => s).join(".");
      return result;
    }

    let { type } = schemaObject as any;

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

    const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

    const stringEnum = ["string", "email", "password", "url", "byte", "binary"];

    if (schemaObject.format && numberEnum.includes(schemaObject.format)) {
      type = "number";
    }

    if (schemaObject.enum) {
      type = "enum";
    }

    if (numberEnum.includes(type)) {
      return "number";
    }

    if (dateEnum.includes(type)) {
      return "Date";
    }

    if (stringEnum.includes(type)) {
      return "string";
    }

    if (type === "boolean") {
      return "boolean";
    }

    if (schemaObject.type === "array") {
      let { items } = schemaObject;

      if (schemaObject.schema) {
        items = schemaObject.schema.items;
      }

      if (Array.isArray(items)) {
        const arrayItemType = (items as any)
          .map((subType) => this.getTypeContent(subType.schema || subType))
          .toString();
        return `[${arrayItemType}]`;
      }

      const arrayType = this.getTypeContent(items);
      return arrayType.includes(" | ") ? `(${arrayType})[]` : `${arrayType}[]`;
    }

    if (type === "enum") {
      return Array.isArray(schemaObject.enum)
        ? Array.from(
            new Set(
              schemaObject.enum.map((v) =>
                typeof v === "string"
                  ? `"${v.replace(/"/g, '"')}"`
                  : this.getTypeContent(v)
              )
            )
          ).join(" | ")
        : "string";
    }

    if (schemaObject.oneOf && schemaObject.oneOf.length) {
      return schemaObject.oneOf
        .map((item) => this.getTypeContent(item))
        .join(" | ");
    }
    if (schemaObject.allOf && schemaObject.allOf.length) {
      return `(${schemaObject.allOf
        .map((item) => this.getTypeContent(item))
        .join(" & ")})`;
    }
    if (schemaObject.type === "object" || schemaObject.properties) {
      if (!Object.keys(schemaObject.properties || {}).length) {
        return "Record<string, any>";
      }
      return `{ ${Object.keys(schemaObject.properties)
        .map((key) => {
          const required =
            "required" in (schemaObject.properties[key] || {})
              ? ((schemaObject.properties[key] || {}) as any).required
              : false;
          /**
           * 将类型属性变为字符串，兼容错误格式如：
           * 3d_tile(数字开头)等错误命名，
           * 在后面进行格式化的时候会将正确的字符串转换为正常形式，
           * 错误的继续保留字符串。
           * */
          return `'${key}'${required ? "" : "?"}: ${this.getTypeContent(
            schemaObject.properties && schemaObject.properties[key]
          )}; `;
        })
        .join("")}}`;
    }
    return "any";
  }
}
