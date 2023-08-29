import _ from "lodash";
import fse from "fs-extra";
import type {
  ApiData,
  ArrayItems,
  BaseType,
  Config,
  GenerateCode,
  HandleComponent,
  OpenApi3FormatData,
  RefHasCache,
} from "./types";
import { formatterBaseType, prettierFile } from "./utils";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import { successLog } from "./log";
import { OpenAPI } from "./OpenAPI";
import { ComponentSchema, ResponseType } from "./types";

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
        .filter((component) => component)
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
    const notHaveResponseRef: ResponseType.NotHaveResponseRef = (
      interfaceName
    ) => {
      return `/** ${apiItem.summary} */
           export  interface ${interfaceName} {}`;
    };

    const notHaveApiNameCache: ResponseType.NotHaveApiNameCache = (
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
    const schemaObjectHas$Ref: ComponentSchema.SchemaObjectHas$Ref = ({
      schemaObject,
      component,
      parent,
      key,
    }) => {
      const componentName = schemaObject.$ref.split("/").pop();

      return `/**${component.title ?? ""}*/
      ${key}${parent?.required?.includes(key || "") ? "" : "?"}:${_.upperFirst(
        componentName
      )}${component.type === "array" ? "[]" : ""}`;
    };
    const arraySchemaObjectItemsHas$Ref: ComponentSchema.ArraySchemaObjectItemsHas$Ref =
      ({ $ref, schemaObjectTitle }) => {
        return `/**${schemaObjectTitle ?? ""}*/
        ${key}${parent?.required?.includes(key || "") ? "" : "?"}:${
          _.upperFirst($ref.split("/").pop()) + "[]"
        }`;
      };
    const arrayItemsNo$ref: ComponentSchema.ArrayItemsNo$ref = ({
      schemaObjectDescription,
      schemaObjectItems,
      parent,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
      ${key ?? ""}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObjectItems)}[]`;
    };
    const objectNotHaveProperties: ComponentSchema.ObjectNotHaveProperties = ({
      schemaObjectDescription,
      parent,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
        ${key ?? ""}${
        parent?.required?.includes(key || "") ? "" : "?"
      }: object`;
    };
    const objectHasProperties: ComponentSchema.ObjectHasProperties = ({
      schemaObject,
    }) => {
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
    };

    const hasEnum: ComponentSchema.HasEnum = ({
      schemaObjectEnum,
      schemaObjectDescription,
      parent,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
      ${key}${
        parent?.required?.includes(key) ? "" : "?"
      }:${this.resolveEnumObject(schemaObjectEnum)}`;
    };

    const baseOfNumber: ComponentSchema.BaseOfNumber = ({
      schemaObject,
      parent,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject)}`;
    };
    const baseOfString: ComponentSchema.BaseOfString = ({
      schemaObject,
      parent,
      key,
    }) => {
      return `${this.getStringDescription(schemaObject)}
      ${key}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject)}`;
    };
    const baseOfBoolean: ComponentSchema.BaseOfBoolean = ({
      schemaObject,
      parent,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}${
        parent?.required?.includes(key || "") ? "" : "?"
      }:${formatterBaseType(schemaObject)}`;
    };

    return this.schemas.handleComponentSchema(
      { schemaObject, key, parent },
      {
        schemaObjectHas$Ref,
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
  resolveEnumObject(schemaObjectEnum: unknown[] | undefined) {
    return Array.isArray(schemaObjectEnum)
      ? _.reduce(
          schemaObjectEnum,
          (result, value, index) => {
            result += `'${value}'${
              schemaObjectEnum?.length === index + 1 ? "" : "|"
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
