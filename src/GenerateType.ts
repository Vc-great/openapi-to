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
import { prettier as defaultPrettierOptions } from "@umijs/fabric";

import ReservedDict from "reserved-words";
export interface APIDataType extends OperationObject {
  path: string;
  method: string;
  description: string;
}

export type TagAPIDataType = Record<string, APIDataType[]>;
// 类型声明过滤关键字
const resolveTypeName = (typeName: string) => {
  if (ReservedDict.check(typeName)) {
    return `__openAPI__${typeName}`;
  }
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

const getType = (
  schemaObject: SchemaObject | undefined,
  namespace: string = ""
): string => {
  if (schemaObject === undefined || schemaObject === null) {
    return "any";
  }
  if (typeof schemaObject !== "object") {
    return schemaObject;
  }
  if (schemaObject.$ref) {
    return [namespace, getRefName(schemaObject)].filter((s) => s).join(".");
  }

  let { type } = schemaObject as any;

  const numberEnum = [
    "int64",
    "integer",
    "long",
    "float",
    "double",
    "number",
    "int",
    "float",
    "double",
    "int32",
    "int64",
  ];

  const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

  const stringEnum = ["string", "email", "password", "url", "byte", "binary"];

  if (numberEnum.includes(schemaObject.format)) {
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

  if (type === "array") {
    let { items } = schemaObject;
    if (schemaObject.schema) {
      items = schemaObject.schema.items;
    }

    if (Array.isArray(items)) {
      const arrayItemType = (items as any)
        .map((subType) => getType(subType.schema || subType, namespace))
        .toString();
      return `[${arrayItemType}]`;
    }
    const arrayType = getType(items, namespace);
    return arrayType.includes(" | ") ? `(${arrayType})[]` : `${arrayType}[]`;
  }

  if (type === "enum") {
    return Array.isArray(schemaObject.enum)
      ? Array.from(
          new Set(
            schemaObject.enum.map((v) =>
              typeof v === "string" ? `"${v.replace(/"/g, '"')}"` : getType(v)
            )
          )
        ).join(" | ")
      : "string";
  }

  if (schemaObject.oneOf && schemaObject.oneOf.length) {
    return schemaObject.oneOf
      .map((item) => getType(item, namespace))
      .join(" | ");
  }
  if (schemaObject.allOf && schemaObject.allOf.length) {
    return `(${schemaObject.allOf
      .map((item) => getType(item, namespace))
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
        return `'${key}'${required ? "" : "?"}: ${getType(
          schemaObject.properties && schemaObject.properties[key],
          namespace
        )}; `;
      })
      .join("")}}`;
  }
  return "any";
};

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

class ApiGenerator {
  protected openAPIData: object; //OpenAPIObject;
  protected apiData: object; // TagAPIDataType = {};
  protected components: object; //components
  currentTagTypeNameCache: Map<string, string>;
  refSchemaAllCache: Map<string, object>;
  protected config: {
    responseReturnIsArray: boolean;
  };
  constructor() {
    this.apiData = apiData;
    this.openAPIData = openAPIData;
    this.components = {};
    // 当前tag的type name缓存,用于去重
    this.currentTagTypeNameCache = new Map();
    //缓存ref 用于去重
    this.refSchemaAllCache = new Map();
    this.config = {
      responseReturnIsArray: true,
    };
  }
  //
  private getCrudRequestPath(list) {
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

  // 生成请求名称
  private generateRequestName(apiItem: APIDataType) {
    const tag = apiItem.tags[0];
    const crudPath = this.getCrudRequestPath(this.apiData[tag]);
    const path = apiItem.path;
    const methodUpperCase = apiItem.method.toUpperCase();

    const name = new Map([
      ["GET", "list"],
      ["POST", "create"],
      ["PUT", "update"],
      ["DELETE", "del"],
      ["PATCH", "patch"],
      ["DETAIL", "detail"],
    ]);

    const isMatch = path === crudPath && name.has(methodUpperCase);

    if (isMatch) {
      return name.get(methodUpperCase);
    }

    const paths = path.split("/").filter((x) => x);
    const hasBracket = paths[paths.length - 1].includes("{");

    const detailPath = path.replace(/\/{([^/]+)}/g, "");

    const isDetail = detailPath === crudPath && methodUpperCase === "GET";

    //detail
    if (hasBracket && isDetail) {
      return name.get("DETAIL") + "By" + this.getPathLastParams(path);
    }
    //其他带括号
    if (hasBracket) {
      const popItem = [...paths].pop();

      return this.dashToUpperCase(popItem.slice(1, popItem.length - 1));
    }

    return this.dashToUpperCase(paths[paths.length - 1]);
  }
  //中划线参数转驼峰
  private dashToUpperCase(path: string) {
    let fullPath =
      path[0] + path.slice(1).replace(/(-\w)/g, (m) => m[1].toUpperCase());
    if (path.startsWith("_")) {
      return fullPath.slice(1, 1).toUpperCase() + fullPath.slice(1);
    } else {
      return fullPath.slice(0, 1).toUpperCase() + fullPath.slice(1);
    }
  }

  //获取路径中最后一个参数
  private getPathLastParams(path: string) {
    const pathParts = path.split("/");

    const part = pathParts[pathParts.length - 1];
    if (part.startsWith("{") && part.endsWith("}")) {
      let fullPath = part
        .slice(1, -1)
        .replace(/(-\w)/g, (m) => m[1].toUpperCase());
      return (
        (part.startsWith("_")
          ? fullPath.slice(1, 1).toUpperCase()
          : fullPath.slice(0, 1).toUpperCase()) + fullPath.slice(1)
      );
    } else {
      return part;
    }
  }

  // 将所有的中划线转换为下划线
  //q: 起个名字中划线转换为下划线方法名
  private dashToUnderline(str: string) {
    return str.replace(/-(\w)/g, (all, letter) => {
      return letter.toUpperCase();
    });
  }
  //请求函数参数
  private generateRequestFunctionParams(parameters: ParameterObject) {
    const hasQuery = _.some(parameters, ["in", "query"]);
    const hasBody = _.has(parameters, "requestBody");
    const hasPath = _.some(parameters, ["in", "path"]);

    const query = `${hasQuery ? "query:QueryRequest" : ""}`;
    const body = hasBody
      ? hasQuery
        ? ",data:DataRequest"
        : "data:DataRequest"
      : "";
    const path =
      hasPath && (hasBody || hasQuery)
        ? ",data:PathRequest"
        : hasPath
        ? ",data:PathRequest"
        : "";

    return `${query}${body}${path}`;
  }

  // 生成请求query参数
  private generateRequestQueryParams(parameters: ParameterObject) {
    const hasQuery = _.some(parameters, ["in", "query"]);
    return hasQuery ? ",params" : "";
  }

  //私有方法 生成body参数
  private generateRequestDataParams(parameters: ParameterObject) {
    const hasBody = _.has(parameters, "requestBody");
    return hasBody ? ",data" : "";
  }

  //summary中有下载或者导出 关键字 则增加type
  private generateResponseType(summary: string) {
    const keys = ["下载", "导出"];
    return _.some(keys, (x) => summary.includes(x))
      ? `responseType:'blob'`
      : "";
  }

  // 生成请求返回值
  private generateRequestReturn(funcName) {
    //todo 首字母大写
    const typeName = `${funcName}Response`;
    return this.config.responseReturnIsArray
      ? `Promise<[object,${typeName},response]>`
      : `Promise<${typeName}>`;
  }
  // 生成请求路径
  private generateRequestPath(item: APIDataType) {
    const path = item.path.replace(/{([\w-]+)}/g, (matchData, params) => {
      return "${" + params + "}";
    });

    return "`" + path + "`";
  }
  // 生成请求描述信息
  private generateRequestDesc(apiItem: APIDataType) {
    return `//${apiItem.summary}`;
  }

  // 生成请求
  public generateRequest(tagList: TagAPIDataType[]) {
    return this.generateRequestClass(
      this.generateRequestClassDesc(tagList),
      this.generateRequestClassBody(tagList)
    );
  }
  // 生成请求体
  private generateRequestClassBody(controllers: TagAPIDataType[]) {
    return controllers.map((item: any) => {
      const requestName = this.generateRequestName(item);
      const requestParams = this.generateRequestFunctionParams(item.parameters);
      const requestQuery = this.generateRequestQueryParams(item.parameters);
      const requestData = this.generateRequestDataParams(item);
      const requestReturn = this.generateRequestReturn(item);
      const requestPath = this.generateRequestPath(item.parameters);
      const RequestDesc = this.generateRequestDesc(item);
      const paramsSerializer = this.generateParamsSerializer(item.parameters);
      const responseType = this.generateResponseType(item.summary);
      return `
                ${RequestDesc}
                async ${requestName}(${requestParams}):${requestReturn} {
                    return request.${item.method}({
                        url: ${requestPath}
                        ${requestQuery}
                        ${requestData}
                        ${responseType}
                        ${paramsSerializer}
                    })
                }
                `;
    });
  }
  //私有方法 生成paramsSerializer
  private generateParamsSerializer(parameters: ParameterObject) {
    const hasQueryArray = _.some(parameters, (x) => x.schema.type === "array");
    return hasQueryArray
      ? `,paramsSerializer(params) {
                            return qs.stringify(params)
                        }`
      : "";
  }

  // 生成请求类
  private generateRequestClass(describe: string, requestBody: string[]) {
    return `
        ${describe}
        class ApiName {
            ${requestBody}
        }
        const apiName = new ApiName();
        return export  apiName;
        `;
  }
  // 生成请求类描述信息
  private generateRequestClassDesc(tagList: TagAPIDataType[]) {
    const head: APIDataType = _.head(tagList);
    return head?.description;
  }
  // 生成ts类型
  public generateTagTypes(tagList: TagAPIDataType[]) {
    //todo new的时候进行格式化,调试阶段临时放置
    this.formatterComponents();
    //每一轮tag 清空cache
    this.currentTagTypeNameCache.clear();

    //query参数
    function getQueryParamsType(apiItem: APIDataType, requestName) {
      const query = _.filter(apiItem.parameters, ["in", "query"]);
      //  console.log("-> query",query);
      if (_.isEmpty(query)) {
        return "";
      }
      const typeString = _.reduce(
        query,
        (str, item) => {
          str += ` \n/** ${item.description} */
                        ${item.name}${item.required ? "?" : ""}:${getType(
            item.schema
          )}`;
          return str;
        },
        ""
      );
      return `export interface ${requestName}QueryRequest {
                ${typeString}
            }
            `;
    }
    //body参数
    const getBodyParamsType = (apiItem: APIDataType, requestName) => {
      const schemaName = _.get(apiItem, "requestBody.$ref", "")
        .split("/")
        .pop();
      const schemaComponent = _.get(this.components, schemaName, {});
      if (_.isEmpty(schemaComponent)) {
        return "";
      }
      /*
                  // 判断refSchemaMap是否已经存储过了refComponent
                  const hasRefSchema= (refComponent,refName,refSchemaAllCache)=>{
                      if(!refSchemaAllCache.has(refName)){
                          return false
                      }
                      //diff
                      return _.isEqual(refSchemaAllCache.get(refName),refComponent)
                  }*/

      //缓存全部$ref 判断是否有重复
      //  const refSchemaAllCache = new Map
      // 缓存$ref  遍历后清空
      const refSchemaCache = new Map();

      const typeStrByComponent = (component, typeStr) => {
        const str = _.reduce(
          component,
          (result, value, key) => {
            const ref = value.$ref || value.items?.$ref || "";
            const refName = ref.split("/").slice(1).pop();
            const refComponent = _.get(this.components, refName, undefined);

            /*                    const  name = (refName,typeName)=>{
                                    if(!this.currentTagTypeNameCache.has(refName)){
                                        this.currentTagTypeNameCache.set(refName,refName)
                                        return refName
                                    }
                                   return this.currentTagTypeNameCache.get(refName)

                                }*/
            //  const typeName = refName?_.upperFirst(requestName) +name( refName,_.upperFirst(value.name)):''
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

      const nextRefSchema = (refSchemaMap, typeStr) => {
        //暂存
        const refSchemaObject = _.cloneDeep(
          Object.fromEntries(refSchemaMap.entries())
        );

        /*                //refSchemaCache 清空 存储到 refSchemaAllCache中
                        for (const [key,value] of refSchemaCache) {
                            this.refSchemaAllCache.set(key,value)
                        }*/
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

      const bodyTypeStr = `
            /** ${apiItem.summary} */
            export interface ${requestName}BodyRequest {
              ${typeStr}
            }`;
      return `${bodyTypeStr} ${refTypeStr}`;

      return result;
    };
    //路径参数
    function getPathParamsType(apiItem: APIDataType, requestName) {
      const pathParams = _.filter(apiItem.parameters, ["in", "path"]);

      return _.reduce(
        pathParams,
        (result, item) => {
          result += `
            /** ${item.description} */
          export  interface ${requestName}PathRequest {
                ${item.name}${item.required ? "?" : ""}:${getType(item.schema)}
            }
            `;
          return result;
        },
        ""
      );
    }

    const getResponseType = (apiItem: APIDataType, requestName) => {
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
        this.components,
        _.last(ref.split("/")),
        {}
      );
      if (_.isEmpty(schemaComponent)) {
        return "";
      }

      // 缓存$ref  遍历后清空
      const refSchemaCache = new Map();

      const typeStrByComponent = (component, typeStr) => {
        const str = _.reduce(
          component,
          (result, value, key) => {
            const ref = value.$ref || value.items?.$ref || "";
            const refName = ref.split("/").slice(1).pop();
            const refComponent = _.get(this.components, refName, undefined);

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

      const nextRefSchema = (refSchemaMap, typeStr) => {
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
      //
      const bodyTypeStr = `
            /** ${apiItem.summary} */
           export  interface ${requestName}Response {
              ${typeStr}
            }`;
      return `${bodyTypeStr} ${refTypeStr}`;
    };

    //生成 types
    const types =
      _.reduce(
        tagList,
        (result, apiItem: APIDataType, tagName) => {
          const requestName = this.firstUpperCase(
            this.generateRequestName(apiItem)
          );
          const types = [
            getQueryParamsType(apiItem, requestName),
            getBodyParamsType(apiItem, requestName),
            getPathParamsType(apiItem, requestName),
            getResponseType(apiItem, requestName),
          ];
          const filterEmpty = (types) => types.filter((type) => type);

          const addType = (types) => {
            return _.reduce(
              types,
              (str, type) => {
                return (str += "\n" + type);
              },
              result
            );
          };
          return _.flow(filterEmpty, addType)(types);
        },
        `
        /** ${tagList[0]?.description} */
         namespace API{`
      ) + "} \n export type { API }";
    //console.log("-> types",types);
    return types;
  }

  //
  private generateTypeByQuery(parameters: ParameterObject) {}

  private generateTypeByPath(parameters: ParameterObject) {}

  private generateTypeByBody() {}

  // 匹配schema
  private matchSchema(schema: any) {}

  //首字母大写
  firstUpperCase(str: string) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
  }

  //
  public getBodyTP(requestBody: any = {}) {
    const reqBody: RequestBodyObject = this.resolveRefObject(requestBody);
    if (!reqBody) {
      return null;
    }
    const reqContent: ContentObject = reqBody.content;
    if (typeof reqContent !== "object") {
      return null;
    }
    let mediaType = Object.keys(reqContent)[0];

    const schema: SchemaObject = reqContent[mediaType].schema || DEFAULT_SCHEMA;

    if (mediaType === "*/*") {
      mediaType = "";
    }
    // 如果 requestBody 有 required 属性，则正常展示；如果没有，默认非必填
    const required =
      typeof requestBody.required === "boolean" ? requestBody.required : false;
    if (schema.type === "object" && schema.properties) {
      const propertiesList = Object.keys(schema.properties)
        .map((p) => {
          if (
            schema.properties &&
            schema.properties[p] &&
            !["binary", "base64"].includes(
              (schema.properties[p] as SchemaObject).format || ""
            ) &&
            !(
              ["string[]", "array"].includes(
                (schema.properties[p] as SchemaObject).type || ""
              ) &&
              ["binary", "base64"].includes(
                ((schema.properties[p] as SchemaObject).items as SchemaObject)
                  .format || ""
              )
            )
          ) {
            return {
              key: p,
              schema: {
                ...schema.properties[p],
                type: getType(schema.properties[p], ""),
                required: schema.required?.includes(p) ?? false,
              },
            };
          }
          return undefined;
        })
        .filter((p) => p);
      return {
        mediaType,
        ...schema,
        required,
        propertiesList,
      };
    }
    return {
      mediaType,
      required,
      type: getType(schema, ""),
    };
  }

  //解析$ref
  private resolveRefObject(refObject: any): any {
    if (!refObject || !refObject.$ref) {
      return refObject;
    }
    const refPaths = refObject.$ref.split("/");
    if (refPaths[0] === "#") {
      refPaths.shift();
      let obj: any = this.openAPIData;
      refPaths.forEach((node: any) => {
        obj = obj[node];
      });
      if (!obj) {
        throw new Error(`[GenSDK] Data Error! Notfoud: ${refObject.$ref}`);
      }
      return {
        ...this.resolveRefObject(obj),
        type: obj.$ref ? this.resolveRefObject(obj).type : obj,
      };
    }
    return refObject;
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

  public getResponseTP(responses: ResponsesObject = {}) {
    const { components } = this.openAPIData;
    const response: ResponseObject | undefined =
      responses &&
      this.resolveRefObject(
        responses.default || responses["200"] || responses["201"]
      );
    const defaultResponse = {
      mediaType: "*/*",
      type: "any",
    };
    if (!response) {
      return defaultResponse;
    }
    const resContent: ContentObject | undefined = response.content;
    const mediaType = Object.keys(resContent || {})[0];
    if (typeof resContent !== "object" || !mediaType) {
      return defaultResponse;
    }
    let schema = (resContent[mediaType].schema ||
      DEFAULT_SCHEMA) as SchemaObject;

    if (schema.$ref) {
      const refPaths = schema.$ref.split("/");
      const refName = refPaths[refPaths.length - 1];
      const childrenSchema = components.schemas[refName] as SchemaObject;
      /*            if (childrenSchema?.type === 'object' && 'properties' in childrenSchema && this.config.dataFields) {
                      schema = this.config.dataFields.map(field => childrenSchema.properties[field]).filter(Boolean)?.[0] || resContent[mediaType].schema || DEFAULT_SCHEMA;
                  }*/
    }

    if ("properties" in schema) {
      Object.keys(schema.properties).map((fieldName) => {
        //
        schema.properties[fieldName]["required"] =
          schema.required?.includes(fieldName) ?? false;
      });
    }
    return {
      mediaType,
      type: getType(schema, this.config.namespace),
    };
  }

  //格式化compone
  formatterComponents() {
    const result = this.getInterfaceTP();

    this.components = result;
  }

  public getInterfaceTP() {
    const schemas = _.reduce(
      _.get(this.openAPIData, "components.schemas", []),
      (result, value, key) => {
        result[key] = this.resolveObject(value).props || {};
        return result;
      },
      {}
    );
    return schemas;
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
            type: getType(schema),
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
              typeof v === "string" ? `"${v.replace(/"/g, '"')}"` : getType(v)
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
        ? [{ ...item, type: getType(item).split("/").pop() }]
        : this.getProps(item)
    );
    return { props };
  }
}

function init() {
  const registerMap = new Map([["ApiGenerator", new ApiGenerator()]]);
  const apiGenerator = registerMap.get("ApiGenerator");
  return _.reduce(
    apiData,
    (result, value, key) => {
      result.push({
        fileName: key, //文件名
        typeData: apiGenerator.generateTagTypes(value), //类型数据
        //requestData:apiGenerator.generateRequest(value),//请求数据
        jsonSchema: [], //jsonSchema
      });
      return result;
    },
    []
  );
}

const result = init();
console.log("-> result", result);

result.forEach((item) => {
  const filePath = path.join("./", "linshi", item.fileName + ".ts");
  console.log("-> linshi");
  const [code, hasError] = prettierFile(item.typeData);
  console.log("-> hasError", hasError);
  fs.writeFileSync(filePath, code, {
    encoding: "utf8",
  });
});
