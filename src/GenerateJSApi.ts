import _ from "lodash";
import { ApiData, Config, GenerateCode, OpenApi3FormatData } from "./types";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import fse from "fs-extra";
import {
  baseDataType,
  downLoadResponseType,
  formatterBaseType,
  generateUploadFormData,
  getParamsSerializer,
  numberEnum,
  prettierFile,
  stringEnum,
} from "./utils";
import { errorLog, successLog } from "./log";
import { BaseData } from "./BaseData";

const errorInterface = `/**
 * error response
 * @typedef {Object} ErrorResponse error
 */`;

export class GenerateJSApi extends BaseData implements GenerateCode {
  public globalDoc: string[];
  public pendingRefCache: Set<string>;
  constructor(
    public config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData);
    this.config = config;

    //缓存$ref
    this.pendingRefCache = new Set();

    //缓存apiName
    this.apiNameCache = new Map();
    //初始化
    this.initGlobalDoc();
  }

  initGlobalDoc() {
    this.globalDoc = [errorInterface];
  }

  run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.initGlobalDoc();
    this.pendingRefCache.clear();
    this.schemas.clearCache();
    this.apiNameCache.clear();
    return {
      title: _.get(_.head(tagItem), "tags[0]", ""),
      codeString: prettierFile(this.generatorClass(tagItem)),
    };
  }

  generatorClass(tagItem: ApiData[]) {
    const str = `
${this.generatorClassJSDoc(tagItem)}
    class ApiName {
        ${tagItem
          .map((apiItem) => {
            super.setApiItem(apiItem);
            return `
        ${this.generatorFuncJSDoc(apiItem)}
        ${this.generatorFuncContent(apiItem)}`;
          })
          .join("")}
        }
        const apiName = new ApiName
        
        export { apiName }
    `;

    return `import request from '@/api/request'
    ${this.globalDoc.join("\n")}
    ${this.getComponentTypeByRef([...this.pendingRefCache.keys()])}
    ${str}`;
  }

  generatorClassJSDoc(tagItem: ApiData[]) {
    const name = _.get(_.head(tagItem), "tags[0]", "");
    const tagDescription = _.get(_.head(tagItem), "tagDescription", "");
    return `/**
           *@tagName ${name}.
           *@tagDescription ${tagDescription}.
           */`;
  }

  generatorFuncContent(apiItem: ApiData) {
    const { formDataHeader, uploadFormData } = generateUploadFormData(
      apiItem,
      this.openApi3SourceData
    );

    //函数参数
    const funcParams = [
      this.path.hasPathParameters ? this.path.parametersName : "",
      this.query.hasQueryParameters ? `query` : "",
      this.requestBody.hasRequestBodyParams ? `body` : "",
    ]
      .filter((x) => x)
      .join();

    const contents = [
      `url:${this.path.url}`,
      this.query.hasQueryParameters ? "params:query" : "",
      this.requestBody.hasRequestBodyParams ? "data:body" : "",
      this.query.hasQueryArrayParameters ? getParamsSerializer() : "",
      downLoadResponseType(apiItem),
      formDataHeader,
    ];
    return ` ${apiItem.requestName}(${funcParams}){${
      uploadFormData ? "\n" + uploadFormData + "\n" : ""
    }
     return request.${apiItem.method}({
        ${_.chain(contents)
          .filter((x) => !!x)
          .reduce((result, value) => {
            result += (result ? ",\n" : "") + value;
            return result;
          }, "")
          .value()}
      })
    }`;
  }

  generateQueryParams(apiItem: ApiData) {
    return _.isEmpty(this.query.parameters)
      ? ""
      : `*@param query
            ${this.handleParameters(this.query.parameters, "query")}`;
  }
  generatePathParams(apiItem: ApiData) {
    return this.handleParameters(this.path.parameters);
  }

  handleParameters(
    parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[],
    namespace?: string
  ) {
    const itemTypeMap = (
      parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
    ): string[] => {
      return _.map(parameters, (item) => {
        //todo 补充逻辑
        if ("$ref" in item) {
          errorLog('JSAPI-> "$ref" in item');
          return "";
        }
        //todo 补充$ref逻辑
        if (item.schema && "$ref" in item.schema) {
          errorLog('JSAPI-> "$ref" in item.schema');
          return "";
        }
        //@param {string} [params.name]  名称
        return `*@param ${this.parametersType(item)} ${this.optionalParameters(
          item,
          namespace
        )} ${item.description ?? ""}`;
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    return _.flow(itemTypeMap, joinItem)(parameters);
  }

  optionalParameters(
    parameters: OpenAPIV3.ParameterObject,
    namespace: string | undefined
  ) {
    const handleName = () => {
      return this.path.parametersName
        .split(",")
        .includes(_.camelCase(parameters.name))
        ? _.camelCase(parameters.name)
        : parameters.name;
    };

    return parameters.required
      ? namespace
        ? namespace + "." + parameters.name
        : handleName()
      : `[${namespace ? namespace + "." : ""}${parameters.name}]`;
  }

  parametersType(parameters: OpenAPIV3.ParameterObject) {
    if (parameters.schema && "$ref" in parameters.schema) {
      errorLog("parametersType");
      return "";
    }

    let type = parameters.schema?.type ?? "";

    if (
      numberEnum.includes(type) ||
      numberEnum.includes(parameters.schema?.format || "")
    ) {
      return "{number}";
    }

    if (stringEnum.includes(type)) {
      return "{string}";
    }

    if (type === "boolean") {
      return "{boolean}";
    }

    if (
      parameters.schema?.type === "array" &&
      !("$ref" in parameters.schema.items)
    ) {
      return `{${parameters.schema.items.type}[]}`;
    }
    //todo
    if (
      parameters.schema?.type === "array" &&
      "$ref" in parameters.schema.items
    ) {
      errorLog("parametersType");
      return ``;
    }

    if (type === "object") {
      return `${parameters.schema?.type}`;
    }
  }

  generateBodyParams(apiItem: ApiData) {
    if (!apiItem.requestBody) {
      return "";
    }

    const interfaceName = `${_.upperFirst(apiItem.requestName)}BodyRequest`;

    let component;

    //查看缓存
    if (
      "$ref" in apiItem.requestBody &&
      this.apiNameCache.has(apiItem.requestBody.$ref)
    ) {
      return `*@param {${this.apiNameCache.get(
        apiItem.requestBody.$ref
      )}} body`;
    }

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
      errorLog("JSAPI-> not find component");
      return "";
    }

    if (component.type === "array" && !("$ref" in component.items)) {
      return `*@param {${formatterBaseType(
        component.items
      )}[]} body ${_.upperFirst(apiItem.requestName)}`;
    }

    //容错 请求body不应该是基本类型
    if (baseDataType.includes(component.type || "")) {
      return `*@param {${formatterBaseType(component)}} body ${interfaceName}`;
    }

    const typeString = this.handleComponentSchema(component, "param", "body.");

    this.globalDoc.push(`/**
    *@apiSummary ${apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    */`);

    return `*@param {${interfaceName}} body`;
  }
  //property
  handleComponentSchema(
    schemaObject:
      | OpenAPIV3.SchemaObject
      | OpenAPIV3.ReferenceObject
      | undefined,
    typeName: "param" | "property",
    namespace = "",
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
      const componentName = schemaObject.$ref.split("/").pop();

      const isRequired = parent?.required?.includes(key || "");
      const type =
        _.upperFirst(componentName) + (component.type === "array" ? "[]" : "");
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            component.title ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${component.title ?? ""}`;
    }

    // 数组类型
    if (schemaObject.type === "array") {
      if ("$ref" in schemaObject.items) {
        this.pendingRefCache.add(schemaObject.items.$ref);

        const [component] = this.schemas.getComponent(schemaObject.items.$ref);

        if (component && "$ref" in component) {
          this.pendingRefCache.add(component.$ref);

          const [componentByRef] = this.schemas.getComponent(
            component.$ref
          ) as [OpenAPIV3.SchemaObject, boolean];
          const componentName = component.$ref.split("/").pop();

          const isRequired = parent?.required?.includes(key || "");
          const type =
            _.upperFirst(componentName) +
            (componentByRef?.type === "array" ? "[]" : "");
          return isRequired
            ? `*@${typeName} {${type}} [${namespace}${key}] ${
                componentByRef?.title ?? ""
              }`
            : `*@${typeName} {${type}} ${namespace}${key} ${
                componentByRef?.title ?? ""
              }`;
        }

        const isRequired = parent?.required?.includes(key || "");
        const type = _.upperFirst(schemaObject.items.$ref.split("/").pop());
        return isRequired
          ? `*@${typeName} {${type}[]} [${namespace}${key}] ${
              component && "title" in component ? component.title : ""
            }`
          : `*@${typeName} {${type}[]} ${namespace}${key} ${
              component && "title" in component ? component.title : ""
            }`;
      }

      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject.items);
      return isRequired
        ? `*@${typeName} {${type}[]} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}[]} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    }

    // 对象类型 properties 不存在
    if (schemaObject.type === "object" && !schemaObject.properties) {
      const isRequired = parent?.required?.includes(key || "");
      return isRequired
        ? `*@${typeName} {object} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {object} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    }

    // 对象类型
    if (schemaObject.type === "object") {
      return _.reduce(
        schemaObject.properties,
        (result, value, key) => {
          result +=
            (result ? "\n" : "") +
            this.handleComponentSchema(
              value,
              typeName,
              namespace,
              key,
              schemaObject
            );
          return result;
        },
        ""
      );
    }
    // 枚举类型
    if (schemaObject.enum) {
      const isRequired = parent?.required?.includes(key || "");
      const type = schemaObject.enum.map((x) => `'${x}'`).join("|");
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      //todo 待补充
      errorLog("JSAPI-> schemaObject.allOf");
    }

    //基本类型
    if (["integer", "number"].includes(schemaObject.type || "")) {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    }

    if (schemaObject.type === "string") {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    }

    if (schemaObject.type === "boolean") {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    }
    errorLog("JSAPI-> handleComponentSchema schemaObject.type");
    return "";
  }

  generateResponseType(apiItem: ApiData) {
    const interfaceName = `${_.upperFirst(apiItem.requestName)}Response`;
    const responseRef = this.response.ref;
    if (!responseRef) {
      return `*@returns {Promise<[ErrorResponse, ${interfaceName}]>}`;
    }

    //已经解析过采用继承的方式
    if (this.apiNameCache.has(responseRef)) {
      return `*@returns {Promise<[ErrorResponse, ${this.apiNameCache.get(
        responseRef
      )}]>}`;
    }
    this.apiNameCache.set(responseRef, interfaceName);

    const [component] = this.schemas.getComponent(responseRef) as [
      OpenAPIV3.SchemaObject,
      boolean
    ];

    const typeString = this.handleComponentSchema(component, "property");

    this.globalDoc.push(`/**
    *@apiSummary ${apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    */`);
    return `*@returns {Promise<[ErrorResponse, ${interfaceName}]>}`;
  }

  getComponentTypeByRef($refs: Array<string>, typeString: string = ""): string {
    this.pendingRefCache.clear();

    const generateInterface = (
      component: OpenAPIV3.SchemaObject,
      index: number
    ) => {
      if (!component) {
        return undefined;
      }
      const interfaceName = _.upperFirst($refs[index].split("/").pop());
      //没有properties
      if (component.type === "object" && !component.properties) {
        return `/**
        *@title ${component.title ?? ""}
        *@typedef {Object} ${interfaceName}
        */`;
      }
      return `/**
        *@title ${component.title ?? ""}
        *@typedef {Object} ${_.upperFirst(interfaceName)}
         ${this.handleComponentSchema(component, "property")}
        */`;
    };

    typeString +=
      (typeString ? "\n" : "") +
      _.chain($refs)
        .map((ref) => this.schemas.getComponent(ref)[0])
        .map((component: OpenAPIV3.SchemaObject, index) =>
          generateInterface(component, index)
        )
        .filter((component) => !!component)

        .join("\n");

    //循环引用
    this.pendingRefCache = new Set(
      _.without([...this.pendingRefCache], ...$refs)
    );

    return this.pendingRefCache.size
      ? this.getComponentTypeByRef([...this.pendingRefCache.keys()], typeString)
      : typeString;
  }

  //生成path

  //函数注释
  generatorFuncJSDoc(apiItem: ApiData) {
    const paramString = [
      this.generateQueryParams(apiItem),
      this.generatePathParams(apiItem),
      this.generateBodyParams(apiItem),
      this.generateResponseType(apiItem),
    ]
      .filter((x) => x)
      .join("\n");

    return `/**
    *@apiSummary ${apiItem.summary ?? ""}
    ${paramString}
    */`;
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}JSApi.js`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} js api write succeeded!`);
  }
}
