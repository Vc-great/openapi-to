// @ts-nocheck
import _ from "lodash";
import { ApiData, GenerateCode, OpenApi3FormatData } from "./types";
import { OpenAPIV3, ParameterObject } from "openapi-types";
import path from "path";
import fse from "fs-extra";
import { prettierFile, numberEnum, stringEnum, BaseType } from "./utils";
import { successLog } from "./log";
import { GenerateApi } from "./GenerateApi";

export class GenerateJSApi extends GenerateApi implements GenerateCode {
  //private apiItem: ApiData[];
  public globalDoc: string[];
  constructor(
    public config: object,
    public openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(config, openApi3SourceData, openApi3FormatData);
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;
    this.config = config;

    //缓存$ref
    this.pendingRefCache = new Set();
    //已解析过的ref
    this.resolveRefCache = new Set();
    //缓存apiName
    this.apiNameCache = new Map();
    this.globalDoc = [];
  }
  run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.globalDoc = [];
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
            const args = this.generatorArguments(apiItem);
            return `
        ${this.generatorFuncJSDoc(apiItem)}
        ${this.generatorFuncContent({
          apiItem,
          ...args,
        })}`;
          })
          .join("")}
        }
        const apiName = new ApiName
        
        export { apiName }
    `;

    return `import request from '@/api/request'
    ${this.funcdoc()}
    ${this.getComponentTypeByRef([...this.pendingRefCache.keys()])}
    ${str}`;
  }
  funcdoc() {
    return this.globalDoc.join("\n");
  }

  generatorClassJSDoc(tagItem: ApiData[]) {
    const name = _.get(_.head(tagItem), "tags[0]", "");
    const description = _.get(_.head(tagItem), "description", "");
    return `/**
           *@tagName ${name}.
           *@tagDescription ${description}.
           */`;
  }

  generatorFuncContent({
    apiItem,
    funcParams,
    requestParams,
    paramsSerializer,
    formData,
    formDataHeader,
  }) {
    //todo 补充 responseType:'blob
    const contents = [
      `url:${super.generatorPath(apiItem)}`,
      requestParams,
      paramsSerializer,
      formDataHeader,
    ];
    const filterContents = (contents) => _.filter(contents, (x) => x);
    const addContents = (contents) =>
      _.reduce(
        contents,
        (result, value) => {
          result += (result ? ",\n" : "") + value;
          return result;
        },
        ""
      );
    return ` ${apiItem.requestName}(${funcParams}){${
      formData ? "\n" + formData + "\n" : ""
    }
      return request.${apiItem.method}({
        ${_.flow([filterContents, addContents])(contents)}
      })
    }`;
  }

  //函数参数
  generatorArguments(apiItem: ApiData) {
    //params路径参数
    const path = _.chain(apiItem.parameters)
      .filter(["in", "path"])
      .map("name")
      .map((name) => _.camelCase(name))
      .join()
      .value();

    //query 查询参数
    const query = _.some(apiItem.parameters, ["in", "query"]);

    //data body参数
    const body = this.requestBodyParams(apiItem);

    const funcParams = [
      path ? `${path}` : "",
      query ? `query` : "",
      body ? `body` : "",
    ]
      .filter((x) => x)
      .join();

    const requestParams = [query ? "params:query" : "", body ? "data:body" : ""]
      .filter((x) => x)
      .join();

    const hasQueryArray = _.some(
      apiItem.parameters,
      (x) => x.schema.type === "array"
    );
    const paramsSerializer = hasQueryArray
      ? `paramsSerializer(params) {
            return qs.stringify(params)
        }`
      : "";
    const { formDataHeader, formData } = this.generateFormData(apiItem);

    //todo application/x-www-form-urlencoded 类型参数

    return {
      funcParams,
      requestParams,
      paramsSerializer,
      formDataHeader,
      formData,
    };
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
    namespace: string | undefined
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
        //@param [params.issueListName]  事项清单名称
        return `*@param ${this.parametersType(item)} ${this.optionalParameters(
          item,
          namespace
        )} -${item.description}`;
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    return _.flow(itemTypeMap, joinItem)(parameters);
  }

  optionalParameters(
    parameters: OpenAPIV3.ParameterObject,
    namespace: string | undefined
  ) {
    return parameters.required
      ? namespace
        ? namespace + "." + parameters.name
        : parameters.name
      : `[${namespace ? namespace + "." : ""}${parameters.name}]`;
  }

  parametersType(parameters: OpenAPIV3.ParameterObject) {
    let type = parameters.schema.type;

    if (
      numberEnum.includes(type) ||
      numberEnum.includes(parameters.schema.format)
    ) {
      return "{number}";
    }

    if (stringEnum.includes(type)) {
      return "{string}";
    }

    if (type === "boolean") {
      return "{boolean}";
    }
    //todo
    if (type === "array") {
      return `{${parameters.schema.items.type}[]}`;
    }
    //todo
    if (type === "object") {
      return `${parameters.schema.type}`;
    }
  }

  generateBodyParams(apiItem: ApiData) {
    if (!apiItem.requestBody) {
      return "";
    }
    const interfaceName = `${_.upperFirst(apiItem.requestName)}BodyRequest`;

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
        const resolveComponent = this.getRequestBodiesComponentByRef(
          media.schema.$ref
        );
        component = resolveComponent;
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
      return `*@param {${this.formatterBaseType(
        component.items
      )}[]} body -${_.upperFirst(apiItem.requestName)}`;
    }

    //容错 请求body不应该是基本类型
    if (BaseType.includes(component.type)) {
      return `*@param {${this.formatterBaseType(
        component
      )}} body -${interfaceName}`;
    }

    const typeString = this.handleComponentSchema(component, "param", "body.");

    return `*@param body
      ${typeString}`;
  }
  //property
  handleComponentSchema(
    schemaObject: OpenAPIV3.SchemaObject | undefined,
    typeName: "param" | "property",
    namespace = "",
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

        const isRequired = parent.required?.includes(key);
        const type = _.upperFirst(schemaObject.items.$ref.split("/").pop());
        return isRequired
          ? `*@${typeName} {${type}[]} [${namespace}${key}] -${
              component.title ?? ""
            }`
          : `*@${typeName} {${type}[]} ${namespace}${key} -${
              component.title ?? ""
            }`;
      }

      const isRequired = parent.required?.includes(key);
      const type = this.formatterBaseType(schemaObject.items);
      return isRequired
        ? `*@${typeName} {${type}[]} [${namespace}${key}] -${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}[]} ${namespace}${key} -${
            schemaObject.description ?? ""
          }`;
    }

    // 对象类型 properties 不存在
    if (schemaObject.type === "object" && !schemaObject.properties) {
      const isRequired = parent.required?.includes(key);
      return isRequired
        ? `*@${typeName} {object} [${namespace}${key}] -${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {object} ${namespace}${key} -${
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
    // 引用类型
    if (schemaObject.$ref) {
      this.pendingRefCache.add(schemaObject.$ref);

      const component = this.getComponentByRef(schemaObject.$ref, false);
      const componentName = schemaObject.$ref.split("/").pop();

      const isRequired = parent.required?.includes(key);
      const type =
        _.upperFirst(componentName) + (component.type === "array" ? "[]" : "");
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] -${
            component.title ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} -${
            component.title ?? ""
          }`;
    }
    // 枚举类型
    if (schemaObject.enum) {
      const isRequired = parent.required?.includes(key);
      const type = schemaObject.enum.map((x) => `'${x}'`).join("|");
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] -${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} -${
            schemaObject.description ?? ""
          }`;
      //todo

      /*      return `/!**${schemaObject.description ?? ""}*!/
      ${key}${
        parent.required?.includes(key) ? "" : "?"
      }:${this.resolveEnumObject(schemaObject)}`;*/
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      //todo 待补充
    }

    //基本类型
    if (["integer", "number"].includes(schemaObject.type)) {
      const isRequired = parent.required?.includes(key);
      const type = this.formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] -${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} -${
            schemaObject.description ?? ""
          }`;
    }

    if (schemaObject.type === "string") {
      const isRequired = parent.required?.includes(key);
      const type = this.formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] -${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} -${
            schemaObject.description ?? ""
          }`;
    }

    if (schemaObject.type === "boolean") {
      const isRequired = parent.required?.includes(key);
      const type = this.formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] -${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} -${
            schemaObject.description ?? ""
          }`;
    }
    console.log("-> 存在异常", schemaObject.type);
    return "";
  }

  generateResponseType(apiItem: ApiData) {
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
      return `*@returns {Promise<[Object, ${interfaceName}]>}`;
    }

    //已经解析过采用继承的方式
    if (this.apiNameCache.has($ref)) {
      return `*@returns {Promise<[Object, ${this.apiNameCache.get($ref)}]>}`;
    }
    this.apiNameCache.set($ref, interfaceName);

    const component = this.getComponentByRef($ref) as OpenAPIV3.SchemaObject;

    const typeString = this.handleComponentSchema(component, "property");

    //todo array
    this.globalDoc.push(`/**
    *${apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    */`);
    return `*@returns {Promise<[Object, ${interfaceName}]>}`;
  }

  formatterBaseType(schemaObject) {
    let type = schemaObject.type;

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

    //todo
    if (type === "object") {
    }
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

  generateResponseParams(apiIem: ApiData) {}

  requestBodyParams(apiItem: ApiData) {
    if (_.get(apiItem, "requestBody.$ref", "")) {
      return "data";
    }

    const media = _.chain(apiItem.requestBody?.content).values().head().value();
    if (!_.isEmpty(media)) {
      return "data";
    }
    return "";
  }

  generateFormData(apiItem: ApiData) {
    const formDataHeader = `headers: { 'Content-Type': 'multipart/form-data' }`;
    const formData = `//todo 上传文件
    const formData = new FormData();
    formData.append("file", file);`;

    if (apiItem.requestBody && "$ref" in apiItem.requestBody) {
      const component: OpenAPIV3.RequestBodyObject = this.getComponentByRef(
        apiItem.requestBody.$ref,
        false
      );
      if (component.content && "multipart/form-data" in component.content) {
        return {
          formDataHeader,
          formData,
        };
      }
    }

    if (
      apiItem.requestBody &&
      "content" in apiItem.requestBody &&
      "multipart/form-data" in apiItem.requestBody.content
    ) {
      return {
        formDataHeader,
        formData,
      };
    }

    return {
      formDataHeader: "",
      formData: "",
    };
  }

  getComponentTypeByRef($refs: Array<string>, typeString: string = ""): string {
    this.pendingRefCache.clear();

    const generateInterface = (component, index) => {
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

      if (component.title === "决策会议及顺序") {
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
    return _.get(
      this.openApi3SourceData,
      ref.split("/").slice(1).join("."),
      undefined
    );
  }

  writeFile(title, codeString) {
    const filePath = path.join(this.config.output, `${title}JSApi.js`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title}ts api write succeeded!`);
  }
}
