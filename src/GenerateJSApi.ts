import _ from "lodash";
import { ApiData, Config, GenerateCode, OpenApi3FormatData } from "./types";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import fse from "fs-extra";
import {
  BaseType,
  numberEnum,
  prettierFile,
  stringEnum,
  getResponseRef,
  formatterBaseType,
} from "./utils";
import { errorLog, successLog } from "./log";
import { GenerateApi } from "./GenerateApi";

const errorInterface = `/**
 * error response
 * @typedef {Object} ErrorResponse error
 */`;

export class GenerateJSApi extends GenerateApi implements GenerateCode {
  public globalDoc: string[];
  public pendingRefCache: Set<string>;
  public resolveRefCache: Set<string>;
  public apiNameCache: Map<string, unknown>;
  constructor(
    public config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData);
    this.config = config;

    //缓存$ref
    this.pendingRefCache = new Set();
    //已解析过的ref
    this.resolveRefCache = new Set();
    //缓存apiName
    this.apiNameCache = new Map();
    //初始化
    this.initGlobalDoc();
  }

  get pathParams() {
    return _.chain(this.apiItem.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  initGlobalDoc() {
    this.globalDoc = [errorInterface];
  }

  run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.initGlobalDoc();
    this.pendingRefCache.clear();
    this.resolveRefCache.clear();
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
    const { formDataHeader, uploadFormData } = super.generateUploadFormData(
      apiItem
    );

    //函数参数
    const funcParams = [
      super.hasPathParameters ? this.pathParams : "",
      super.hasQueryParameters ? `query` : "",
      super.hasRequestBodyParams ? `body` : "",
    ]
      .filter((x) => x)
      .join();

    const contents = [
      `url:${super.generatorPath(apiItem)}`,
      super.hasQueryParameters ? "params:query" : "",
      super.hasRequestBodyParams ? "data:body" : "",
      super.getParamsSerializer(),
      this.downLoadResponseType(),
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
    const query = _.filter(apiItem.parameters, ["in", "query"]);
    if (_.isEmpty(query)) return "";
    return `*@param query
            ${this.handleParameters(query, "query")}`;
  }
  generatePathParams(apiItem: ApiData) {
    const pathParams = _.filter(apiItem.parameters, ["in", "path"]);
    if (_.isEmpty(pathParams)) return "";
    return this.handleParameters(pathParams);
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
      return this.pathParams.split(",").includes(_.camelCase(parameters.name))
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
      errorLog("JSAPI-> not find component");
      return "";
    }

    if (component.type === "array" && !("$ref" in component.items)) {
      return `*@param {${formatterBaseType(
        component.items
      )}[]} body ${_.upperFirst(apiItem.requestName)}`;
    }

    //容错 请求body不应该是基本类型
    if (BaseType.includes(component.type || "")) {
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

      const component = this.getComponentByRef(
        schemaObject.$ref,
        false
      ) as OpenAPIV3.SchemaObject;
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

        const component = this.getComponentByRef(
          schemaObject.items.$ref,
          false
        );

        if (component && "$ref" in component) {
          this.pendingRefCache.add(component.$ref);

          const componentByRef = this.getComponentByRef(
            component.$ref,
            false
          ) as OpenAPIV3.SchemaObject;
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
    const responseRef = getResponseRef(apiItem);
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

    const component = this.getComponentByRef(
      responseRef
    ) as OpenAPIV3.SchemaObject;

    const typeString = this.handleComponentSchema(component, "property");

    this.globalDoc.push(`/**
    *@apiSummary ${apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    */`);
    return `*@returns {Promise<[ErrorResponse, ${interfaceName}]>}`;
  }

  getRequestBodiesComponentByRef(
    ref: string = "",
    refsCache: Array<string> = []
  ): [undefined | OpenAPIV3.SchemaObject, string[]] {
    const schemaComponent = this.getComponentByRef(ref, false);

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
        .map((ref) => this.getComponentByRef(ref))
        .map((component: OpenAPIV3.SchemaObject, index) =>
          generateInterface(component, index)
        )
        .filter((component) => !!component)

        .join("\n");

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
    return _.get(this.openApi3SourceData, ref.split("/").slice(1).join("."));
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}JSApi.js`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} js api write succeeded!`);
  }
}
