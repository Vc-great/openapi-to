import _ from "lodash";
import type {
  ApiData,
  ArrayItems,
  BaseType,
  Config,
  GenerateCode,
  HandleComponent,
  OpenApi3FormatData,
  RefHasCache,
  ResponseType,
  ComponentSchema,
} from "./types";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import fse from "fs-extra";
import {
  downLoadResponseType,
  formatterBaseType,
  generateUploadFormData,
  getParamsSerializer,
  numberEnum,
  prettierFile,
  stringEnum,
} from "./utils";
import { errorLog, successLog } from "./log";
import { OpenAPI } from "./OpenAPI";

const errorInterface = `/**
 * error response
 * @typedef {Object} ErrorResponse error
 */`;

export class GenerateJSRequest extends OpenAPI implements GenerateCode {
  public globalDoc: string[];
  constructor(
    public config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData);
    this.config = config;
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
            this.apiItem = apiItem;
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

  generateQueryParams() {
    return _.isEmpty(this.query.parameters)
      ? ""
      : `*@param query
            ${this.handleParameters(this.query.parameters, "query")}`;
  }
  generatePathParams() {
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
    const refHasCache: RefHasCache = (interfaceName, $ref) => {
      return `*@param {${this.apiNameCache.get($ref)}} body`;
    };

    const arrayItems: ArrayItems = (interfaceName, items) => {
      return `*@param {${formatterBaseType(items)}[]} body ${_.upperFirst(
        this.apiItem.requestName
      )}`;
    };

    const baseType: BaseType = (interfaceName, component) => {
      return `*@param {${formatterBaseType(component)}} body ${interfaceName}`;
    };

    const handleComponent: HandleComponent = (interfaceName, component) => {
      const typeString = this.handleComponentSchema(
        component,
        "param",
        "body."
      );

      this.globalDoc.push(`/**
    *@apiSummary ${this.apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    */`);

      return `*@param {${interfaceName}} body`;
    };

    return this.requestBody.getParams({
      refHasCache,
      arrayItems,
      baseType,
      handleComponent,
    });
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
    const schemaObjectHas$Ref: ComponentSchema.SchemaObjectHas$Ref = ({
      schemaObject,
      component,
      parent,
      key,
    }) => {
      const componentName = schemaObject.$ref.split("/").pop();

      const isRequired = parent?.required?.includes(key || "");
      const type =
        _.upperFirst(componentName) + (component.type === "array" ? "[]" : "");
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            component.title ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${component.title ?? ""}`;
    };
    const arraySchemaObjectItemsHas$RefOfComponent: ComponentSchema.ArraySchemaObjectItemsHas$RefOfComponent =
      ({ componentBySchemaObjectItemsRef, component, parent, key }) => {
        const componentName = componentBySchemaObjectItemsRef.$ref
          .split("/")
          .pop();

        const isRequired = parent?.required?.includes(key || "");
        const type =
          _.upperFirst(componentName) +
          (component?.type === "array" ? "[]" : "");
        return isRequired
          ? `*@${typeName} {${type}} [${namespace}${key}] ${
              component?.title ?? ""
            }`
          : `*@${typeName} {${type}} ${namespace}${key} ${
              component?.title ?? ""
            }`;
      };
    //todo

    const arraySchemaObjectItemsHas$Ref: ComponentSchema.ArraySchemaObjectItemsHas$Ref =
      ({ $ref, schemaObjectTitle }) => {
        const isRequired = parent?.required?.includes(key || "");
        const type = _.upperFirst($ref.split("/").pop());
        return isRequired
          ? `*@${typeName} {${type}[]} [${namespace}${key}] ${
              schemaObjectTitle ? schemaObjectTitle : ""
            }`
          : `*@${typeName} {${type}[]} ${namespace}${key} ${
              schemaObjectTitle ? schemaObjectTitle : ""
            }`;
      };
    const arrayItemsNo$ref: ComponentSchema.ArrayItemsNo$ref = ({
      schemaObjectDescription,
      schemaObjectItems,
      parent,
      key,
    }) => {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObjectItems);
      return isRequired
        ? `*@${typeName} {${type}[]} [${namespace}${key}] ${
            schemaObjectDescription ?? ""
          }`
        : `*@${typeName} {${type}[]} ${namespace}${key} ${
            schemaObjectDescription ?? ""
          }`;
    };
    const objectNotHaveProperties: ComponentSchema.ObjectNotHaveProperties = ({
      schemaObjectDescription,
      parent,
      key,
    }) => {
      const isRequired = parent?.required?.includes(key || "");
      return isRequired
        ? `*@${typeName} {object} [${namespace}${key}] ${
            schemaObjectDescription ?? ""
          }`
        : `*@${typeName} {object} ${namespace}${key} ${
            schemaObjectDescription ?? ""
          }`;
    };
    const objectHasProperties: ComponentSchema.ObjectHasProperties = ({
      schemaObject,
    }) => {
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
    };

    const hasEnum: ComponentSchema.HasEnum = ({
      schemaObjectEnum,
      schemaObjectDescription,
      parent,
      key,
    }) => {
      const isRequired = parent?.required?.includes(key || "");
      const type = schemaObjectEnum.map((x) => `'${x}'`).join("|");
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObjectDescription ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObjectDescription ?? ""
          }`;
    };
    const baseOfNumber: ComponentSchema.BaseOfNumber = ({
      schemaObject,
      parent,
      key,
    }) => {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    };
    const baseOfString: ComponentSchema.BaseOfString = ({
      schemaObject,
      parent,
      key,
    }) => {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    };
    const baseOfBoolean: ComponentSchema.BaseOfBoolean = ({
      schemaObject,
      parent,
      key,
    }) => {
      const isRequired = parent?.required?.includes(key || "");
      const type = formatterBaseType(schemaObject);
      return isRequired
        ? `*@${typeName} {${type}} [${namespace}${key}] ${
            schemaObject.description ?? ""
          }`
        : `*@${typeName} {${type}} ${namespace}${key} ${
            schemaObject.description ?? ""
          }`;
    };

    return this.schemas.handleComponentSchema(
      { schemaObject, key, parent },
      {
        schemaObjectHas$Ref,
        arraySchemaObjectItemsHas$RefOfComponent,
        arraySchemaObjectItemsHas$Ref,
        arrayItemsNo$ref,
        objectNotHaveProperties,
        objectHasProperties,
        hasEnum,
        baseOfNumber,
        baseOfString,
        baseOfBoolean,
      }
    );
  }

  generateResponseType(apiItem: ApiData) {
    const notHaveResponseRef: ResponseType.NotHaveResponseRef = (
      interfaceName
    ) => {
      return `*@returns {Promise<[ErrorResponse, ${interfaceName}]>}`;
    };

    const notHaveApiNameCache: ResponseType.NotHaveApiNameCache = (
      responseRef
    ) => {
      return `*@returns {Promise<[ErrorResponse, ${this.apiNameCache.get(
        responseRef
      )}]>}`;
    };

    const handleComponent: HandleComponent = (interfaceName, component) => {
      const typeString = this.handleComponentSchema(component, "property");

      this.globalDoc.push(`/**
    *@apiSummary ${apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    */`);
      return `*@returns {Promise<[ErrorResponse, ${interfaceName}]>}`;
    };

    return this.response.getComponent({
      notHaveResponseRef,
      notHaveApiNameCache,
      handleComponent,
    });

    /*    const interfaceName = `${_.upperFirst(apiItem.requestName)}Response`;
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

    this.globalDoc.push(`/!**
    *@apiSummary ${apiItem.summary}
    *@typedef {Object} ${interfaceName}
      ${typeString}
    *!/`);
    return `*@returns {Promise<[ErrorResponse, ${interfaceName}]>}`;*/
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
      this.generateQueryParams(),
      this.generatePathParams(),
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
    successLog(`${title} js request write succeeded!`);
  }
}
