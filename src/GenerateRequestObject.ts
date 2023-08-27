import { ApiData, Config, GenerateCode, OpenApi3FormatData } from "./types";
import { OpenAPIV3 } from "openapi-types";
import { BaseData } from "./BaseData";
import _ from "lodash";
import {
  baseDataType,
  formatterBaseType,
  numberEnum,
  prettierFile,
  stringEnum,
} from "./utils";
import { errorLog, successLog } from "./log";
import fse from "fs-extra";
import path from "path";

export class GenerateRequestObject extends BaseData implements GenerateCode {
  pendingRefCache: Set<string>;

  enumSchema: Map<string, object>;
  constructor(
    public config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData);
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;

    //缓存$ref
    this.pendingRefCache = new Set();
    //缓存apiName
    this.apiNameCache = new Map();
    this.enumSchema = new Map();
    this.config = config;
  }

  public run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.pendingRefCache.clear();
    this.schemas.clearCache();
    this.apiNameCache.clear();

    const tagItemTypeString = tagItem
      .map((apiItem) => {
        this.setApiItem(apiItem);
        const types = [
          this.getQueryParams(apiItem),
          this.getRequestBodyParams(apiItem),
        ];
        const filterEmpty = (types: string[]) => types.filter((type) => type);
        const addlineFeed = (types: string[]) => types.join("\n");

        return _.flow([filterEmpty, addlineFeed])(types);
      })
      .join("\n");

    return {
      title: _.get(_.head(tagItem), "tags[0]", ""),
      codeString: prettierFile(tagItemTypeString),
    };
  }

  getQueryParams(apiItem: ApiData) {
    if (_.isEmpty(this.query.parameters)) {
      return "";
    }
    return `const ${_.upperFirst(this.apiItem.requestName)}QueryRequest = {
        ${this.handleParameters(this.query.parameters)}
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
              ${
                item.name.includes("-") ? _.camelCase(item.name) : item.name
              }:'',`;
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    return _.flow(itemTypeMap, joinItem)(parameters);
  }

  formatterBaseType(schemaObject: OpenAPIV3.SchemaObject | undefined) {
    if (_.isNil(schemaObject)) {
      return "";
    }
    let type = schemaObject.type;

    if (
      numberEnum.includes(type || "") ||
      numberEnum.includes(schemaObject.format || "")
    ) {
      return 0;
    }

    /*   if (dateEnum.includes(type)) {
          return "Date";
        }*/

    if (stringEnum.includes(type || "")) {
      return "";
    }

    if (type === "boolean") {
      return false;
    }

    if (
      type === "array" &&
      "items" in schemaObject &&
      "type" in schemaObject.items
    ) {
      return `[]`;
    }

    //todo
    if (type === "object") {
      errorLog('requestObject type === "object');
    }

    errorLog("requestObject formatterBaseType");
  }
  getRequestBodyParams(apiItem: ApiData) {
    if (!apiItem.requestBody || !["post", "put"].includes(apiItem.method)) {
      return "";
    }
    const interfaceName = `${_.upperFirst(apiItem.requestName)}BodyRequest`;
    //已经解析过采用继承的方式
    if (
      "$ref" in apiItem.requestBody &&
      this.apiNameCache.has(apiItem.requestBody.$ref)
    ) {
      return `/** ${apiItem.summary ?? ""} */
      const ${interfaceName} = ${this.apiNameCache.get(
        apiItem.requestBody.$ref
      )}`;
    }

    let component;

    if ("$ref" in apiItem.requestBody) {
      const [resolveComponent, resolveRefs] = this.requestBody.getComponent(
        apiItem.requestBody.$ref
      );

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
        const [resolveComponent, resolveRefs] = this.requestBody.getComponent(
          media.schema.$ref
        );
        component = resolveComponent;
        [...resolveRefs, media.schema.$ref].forEach((ref) =>
          this.apiNameCache.set(ref, interfaceName)
        );
      } else {
        component = media.schema;
      }
    }
    //todo 优化
    if (!component) {
      return "";
    }

    if (
      component.type === "array" &&
      component.items &&
      !("$ref" in component.items)
    ) {
      return `/** ${apiItem.summary} */
      const ${interfaceName} = []`;
    }

    //容错 请求body不应该是基本类型
    if (baseDataType.includes(component.type || "")) {
      return `/** ${apiItem.summary} */
            const ${interfaceName} = ${formatterBaseType(component)}`;
    }

    const typeString = this.handleComponentSchema(component);

    const bodyType = `/** ${apiItem.summary ?? ""} */
            const ${interfaceName} = {
              ${typeString}
            }`;
    return `${bodyType}`;
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

      const [component] = this.schemas.getComponent(schemaObject.$ref) as [
        OpenAPIV3.SchemaObject,
        boolean
      ];

      return `/**${component.title ?? ""}*/
      ${key}:${component.type === "array" ? "[]," : "'',"}`;
    }
    // 数组类型
    if (schemaObject.type === "array") {
      if ("$ref" in schemaObject.items) {
        this.pendingRefCache.add(schemaObject.items.$ref);

        const [component] = this.schemas.getComponent(
          schemaObject.items.$ref
        ) as [OpenAPIV3.SchemaObject, boolean];

        return `/**${component.title ?? ""}*/
        ${key}:[],`;
      }

      return `/**${schemaObject.description ?? ""}*/
      ${key ?? ""}:[],`;
    }

    // 对象类型 properties 不存在
    if (schemaObject.type === "object" && !schemaObject.properties) {
      return `/**${schemaObject.description ?? ""}*/
        ${key ?? ""}: {},`;
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
      ${key}:'',`;
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      //todo 待补充
      errorLog("request Object schemaObject.allOf");
      return "";
    }

    //基本类型
    if (["integer", "number"].includes(schemaObject.type || "")) {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:0,`;
    }

    if (schemaObject.type === "string") {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:'',`;
    }

    if (schemaObject.type === "boolean") {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:false,`;
    }
    errorLog("TS interface schemaObject.type");
    return "";
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}RequestObject.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} requestObject write succeeded!`);
  }
}
