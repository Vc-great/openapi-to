import _ from "lodash";
import fse from "fs-extra";
import type {
  ApiData,
  ArrayItems,
  BaseType,
  Config,
  GenerateCode,
  HandleComponent,
  NotHaveResponseRef,
  OpenApi3FormatData,
  RefHasCache,
} from "./types";
import { formatterBaseType, prettierFile } from "./utils";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import { errorLog, successLog } from "./log";
import { OpenAPI } from "./OpenAPI";
import { NotHaveApiNameCache } from "./types";

export class GenerateTSInterface extends OpenAPI implements GenerateCode {
  enumSchema: Map<string, object>;
  constructor(
    public config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData);
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;

    this.enumSchema = new Map();
    this.config = config;
  }

  //query参数
  getQueryParamsType(apiItem: ApiData) {
    return `/** ${apiItem.summary ?? ""}*/
    export interface ${_.upperFirst(apiItem.requestName)}QueryRequest {
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
              ${item.name.includes("-") ? _.camelCase(item.name) : item.name}${
          item.required ? "" : "?"
        }:${formatterBaseType(item.schema)}`;
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    return _.flow(itemTypeMap, joinItem)(parameters);
  }

  getBodyParamsType() {
    const refHasCache: RefHasCache = (interfaceName, $ref) => {
      return `/** ${this.apiItem.summary ?? ""} */
      export interface ${interfaceName} extends ${this.apiNameCache.get(
        $ref
      )}{}`;
    };

    const arrayItems: ArrayItems = (interfaceName, items) => {
      return `/** ${this.apiItem.summary} */
      export type ${interfaceName} = ${formatterBaseType(items)}[]`;
    };

    const baseType: BaseType = (interfaceName, component) => {
      return `/** ${this.apiItem.summary} */
            export type ${interfaceName} = ${formatterBaseType(component)}`;
    };

    const handleComponent: HandleComponent = (interfaceName, component) => {
      const typeString = this.handleComponentSchema(component);

      const bodyType = `/** ${this.apiItem.summary ?? ""} */
            export interface ${interfaceName} {
              ${typeString}
            }`;
      return `${bodyType}`;
    };

    return this.requestBody.getParams({
      refHasCache,
      arrayItems,
      baseType,
      handleComponent,
    });
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
        .map((ref) => this.schemas.getComponent(ref)[0])
        .map((component: OpenAPIV3.SchemaObject | undefined, index) =>
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

  getResponseType(apiItem: ApiData) {
    const notHaveResponseRef: NotHaveResponseRef = (interfaceName) => {
      return `/** ${apiItem.summary} */
           export  interface ${interfaceName} {}`;
    };

    const notHaveApiNameCache: NotHaveApiNameCache = (
      responseRef,
      interfaceName
    ) => {
      return `/!** ${apiItem.summary} *!/
      export interface ${interfaceName} extends ${this.apiNameCache.get(
        responseRef
      )}{}`;
    };

    const handleComponent: HandleComponent = (interfaceName, component) => {
      const typeString = this.handleComponentSchema(component);

      //
      const bodyTypeStr = `/** ${apiItem.summary} */
           export  interface ${interfaceName} {
              ${typeString}
            }`;
      return `${bodyTypeStr}`;
    };

    return this.response.getComponent({
      notHaveResponseRef,
      notHaveApiNameCache,
      handleComponent,
    });

    /*    const responseRef = this.response.ref;
    const interfaceName = `${_.upperFirst(apiItem.requestName)}Response`;

    if (!responseRef) {
      return `/!** ${apiItem.summary} *!/
           export  interface ${interfaceName} {}`;
    }

    //已经解析过采用继承的方式
    if (this.apiNameCache.has(responseRef)) {
      return `/!** ${apiItem.summary} *!/
      export interface ${interfaceName} extends ${this.apiNameCache.get(
        responseRef
      )}{}`;
    }
    this.apiNameCache.set(responseRef, interfaceName);

    const [component] = this.schemas.getComponent(responseRef) as [
      OpenAPIV3.SchemaObject,
      boolean
    ];

    const typeString = this.handleComponentSchema(component);

    //
    const bodyTypeStr = `/!** ${apiItem.summary} *!/
           export  interface ${interfaceName} {
              ${typeString}
            }`;
    return `${bodyTypeStr}`;*/
  }
  // 生成ts类型
  public run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.pendingRefCache.clear();
    this.schemas.clearCache();
    this.apiNameCache.clear();

    const tagItemTypeString = tagItem
      .map((apiItem) => {
        this.apiItem = apiItem;
        const types = [
          this.getQueryParamsType(apiItem),
          this.getBodyParamsType(),
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

      const [component] = this.schemas.getComponent(schemaObject.$ref) as [
        OpenAPIV3.SchemaObject,
        boolean
      ];
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

        const [component] = this.schemas.getComponent(
          schemaObject.items.$ref
        ) as [OpenAPIV3.SchemaObject, boolean];

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
