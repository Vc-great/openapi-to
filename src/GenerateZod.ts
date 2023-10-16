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
import { numberEnum, prettierFile, stringEnum } from "./utils";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import { errorLog, successLog } from "./log";
import { OpenAPI } from "./OpenAPI";
import { ComponentSchema, Parameter, ResponseType } from "./types";

export class GenerateZod extends OpenAPI implements GenerateCode {
  enumSchema: Map<string, object>;
  zodName: Set<string>;
  typeByZod: Set<string>;
  constructor(
    config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData, config);
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;

    this.enumSchema = new Map();
    this.zodName = new Set();
    this.typeByZod = new Set();
  }

  //query参数
  getQueryParamsType() {
    if (_.isEmpty(this.query.parameters)) {
      return "";
    }

    const zod = `/** ${this.apiItem.summary ?? ""}*/
       const ${this.lowerFirstQueryRequestName} = z.object({
       ${this.handleParameters(this.query.parameters)}
       })`;

    const type = `/** ${this.apiItem.summary ?? ""}*/
    export type ${this.queryRequestName} =  z.infer<typeof ${
      this.lowerFirstQueryRequestName
    }>`;

    this.typeByZod.add(type);

    this.zodName.add(`/** ${this.apiItem.summary ?? ""}*/
    ${this.lowerFirstQueryRequestName}`);

    return zod;
  }

  getPathParams() {
    if (_.isEmpty(this.path.parameters)) {
      return "";
    }

    const zod = `/** ${this.apiItem.summary ?? ""}*/
       const ${this.lowerFirstPathRequestName} = z.object({
       ${this.handleParameters(this.path.parameters)}
       })`;

    const type = `/** ${this.apiItem.summary ?? ""}*/
    export type ${this.pathRequestName} =  z.infer<typeof ${
      this.lowerFirstPathRequestName
    }>`;

    this.typeByZod.add(type);

    this.zodName.add(`/** ${this.apiItem.summary ?? ""}*/
    ${this.lowerFirstPathRequestName}`);

    return zod;
  }

  handleParameters(
    parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
  ) {
    const other: Parameter.other = ({ item, schema }) => {
      return `/** ${item.description ?? ""} */
              ${
                item.name.includes("-") ? _.camelCase(item.name) : item.name
              }:${this.formatterBaseType(schema)}${
        schema?.type === "array" ? ".array()" : ""
      }${item.required ? "" : ".optional()"},`;
    };

    return this.traverseParameters(parameters, {
      other,
    });
  }

  formatterBaseType(schemaObject: OpenAPIV3.SchemaObject | undefined): string {
    if (_.isNil(schemaObject)) {
      return "";
    }
    let type = schemaObject.type;

    if (
      numberEnum.includes(type || "") ||
      numberEnum.includes(schemaObject.format || "")
    ) {
      return "z.number()";
    }

    /*   if (dateEnum.includes(type)) {
          return "Date";
        }*/

    if (stringEnum.includes(type || "")) {
      return "z.string()";
    }

    if (type === "boolean") {
      return "z.boolean()";
    }

    if (
      type === "array" &&
      "items" in schemaObject &&
      "type" in schemaObject.items
    ) {
      return `${this.formatterBaseType(schemaObject.items)}`;
    }

    //todo
    if (type === "object") {
      errorLog("type ===object");
      return "";
    }

    errorLog("interface type");
    return "";
  }

  getBodyParamsType() {
    const refHasCache: RefHasCache = ($ref) => {
      return `/** ${this.apiItem.summary ?? ""} */
     const  ${this.lowerFirstBodyRequestName} =z.lazy(() =>${_.lowerFirst(
        this.apiNameCache.get($ref)
      )}.extend({}))`;
    };

    const arrayItems: ArrayItems = (items) => {
      return `/** ${this.apiItem.summary} */
      const ${this.lowerFirstBodyRequestName} = ${this.formatterBaseType(
        items
      )}.array()`;
    };

    const baseType: BaseType = (component) => {
      return `/** ${this.apiItem.summary} */
           const  ${this.lowerFirstBodyRequestName} = ${this.formatterBaseType(
        component
      )}`;
    };

    const handleComponent: HandleComponent = (component) => {
      const typeString = this.handleComponentSchema(component);

      return `/** ${this.apiItem.summary ?? ""} */
           const  ${this.lowerFirstBodyRequestName} = z.object({
              ${typeString}
            })`;
    };

    const zod = this.requestBody.getParams({
      refHasCache,
      arrayItems,
      baseType,
      handleComponent,
    });

    const type = zod
      ? `/** ${this.apiItem.summary ?? ""} */
    export type ${this.bodyRequestName}= z.infer<typeof ${
          this.lowerFirstBodyRequestName
        }>`
      : "";
    zod &&
      this.zodName.add(`/** ${this.apiItem.summary ?? ""} */
    ${this.lowerFirstBodyRequestName}`);

    this.typeByZod.add(type);
    return zod;
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
      const lowFirstInterfaceName = _.lowerFirst($refs[index].split("/").pop());
      //没有properties
      if (component.type === "object" && !component.properties) {
        this.zodName.add(`/**${component.title}*/
    ${lowFirstInterfaceName}`);

        const zod = `/**${component.title}*/
       const ${lowFirstInterfaceName} = z.object({}),`;
        const type = `/**${component.title}*/
                           export type ${interfaceName} = z.infer<typeof ${lowFirstInterfaceName}>`;
        this.typeByZod.add(type);

        this.zodName.add(`/**${component.title}*/
         ${lowFirstInterfaceName}`);

        return zod;
      }

      this.zodName.add(`/**${component.title}*/
    ${lowFirstInterfaceName}`);

      const zod = `/**${component.title ?? ""}*/
     const ${lowFirstInterfaceName} = z.object({
      ${this.handleComponentSchema(component)}
      })`;
      const type = `/**${component.title ?? ""}*/
      export type ${_.upperFirst(
        interfaceName
      )} = z.infer<typeof ${lowFirstInterfaceName}>`;

      this.typeByZod.add(type);
      return zod;
    };

    typeString +=
      (typeString ? "\n" : "") +
      _.chain($refs)
        .map((ref) => this.schemas.getComponentResolveRefCache(ref))
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
    const withOutResponseRef: ResponseType.withOutResponseRef = () => {
      return `/** ${apiItem.summary} */
          const  ${this.lowFirstResponseName} = z.object({})`;
    };

    const withOutApiNameCache: ResponseType.withOutApiNameCache = (
      responseRef
    ) => {
      return `/** ${apiItem.summary} */
     const  ${this.lowFirstResponseName} = z.lazy(() =>${_.lowerFirst(
        this.apiNameCache.get(responseRef)
      )}.extend({}))`;
    };

    const handleComponent: HandleComponent = (component) => {
      const typeString = this.handleComponentSchema(component);

      //
      const bodyTypeStr = `/** ${apiItem.summary} */
          const  ${this.lowFirstResponseName} =  z.object({
            ${typeString}
            })`;
      return bodyTypeStr;
    };

    const zod = this.response.getComponent({
      withOutResponseRef,
      withOutApiNameCache,
      handleComponent,
    });

    const type = `/** ${this.apiItem.summary ?? ""} */
   export type ${this.responseName}= z.infer<typeof ${
      this.lowFirstResponseName
    }>`;

    this.zodName.add(`/** ${this.apiItem.summary ?? ""} */
    ${this.lowFirstResponseName}`);

    this.typeByZod.add(type);
    return zod;
  }
  // 生成ts类型
  public run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.pendingRefCache.clear();
    this.schemas.clearCache();
    this.apiNameCache.clear();
    this.zodName.clear();
    this.typeByZod.clear();

    const tagItemString = tagItem
      .map((apiItem) => {
        this.apiItem = apiItem;
        const queryZod = this.getQueryParamsType();
        const pathZod = this.getPathParams();
        const bodyZod = this.getBodyParamsType();
        const responseZod = this.getResponseType(apiItem);
        const componentZod = this.getComponentTypeByRef([
          ...this.pendingRefCache.keys(),
        ]);
        const zods = [queryZod, pathZod, bodyZod, responseZod, componentZod];

        const filterEmpty = (types: string[]) => types.filter((type) => type);
        const addType = (types: string[]) => types.join("\n");

        return _.flow([filterEmpty, addType])(zods);
      })
      .join("\n");

    const addEslint = (tagItemString: string) => `
    //eslint-disable-next-line @typescript-eslint/no-namespace
    import {z} from 'zod'

      ${tagItemString}
      
      /**
     *@tag ${_.get(tagItem, "[0].tags[0]", "")}
     *@description ${_.get(tagItem, "[0].tagDescription", "")}
     */
     //todo edit zod name
    export const ZOD = {
    ${[...this.zodName].join(",\n")}
}
    
    
    
    /**
     *@tag ${_.get(tagItem, "[0].tags[0]", "")}
     *@description ${_.get(tagItem, "[0].tagDescription", "")}
     */
     //todo edit namespace name
    export namespace ApiType {
      /**error response*/
       export interface ErrorResponse {}
      ${[...this.typeByZod].join("\n")}
  
    }
      ${this.getEnumOption(Array.from(this.enumSchema.entries()))}
    `;

    return {
      title: _.get(_.head(tagItem), "tags[0]", ""),
      codeString: prettierFile(addEslint(tagItemString)),
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
        export const ${_.camelCase(key)}Option = [
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
      ${key}:z.lazy(()=>${_.lowerFirst(componentName)}${
        component.type === "array" ? ".array()" : ""
      }${parent?.required?.includes(key || "") ? "" : ".optional()"}),`;
    };
    const arraySchemaObjectItemsHas$Ref: ComponentSchema.ArraySchemaObjectItemsHas$Ref =
      ({ $ref, schemaObjectTitle }) => {
        return `/**${schemaObjectTitle ?? ""}*/
        ${key}:z.lazy(()=>${_.lowerFirst($ref.split("/").pop())}.array()${
          parent?.required?.includes(key || "") ? "" : ".optional()"
        }),`;
      };
    const arrayItemsNo$ref: ComponentSchema.ArrayItemsNo$ref = ({
      schemaObjectDescription,
      schemaObjectItems,
      parent,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
      ${key ?? ""}:${this.formatterBaseType(schemaObjectItems)}.array()${
        parent?.required?.includes(key || "") ? "" : ".optional()"
      },`;
    };
    const objectNotHaveProperties: ComponentSchema.ObjectNotHaveProperties = ({
      schemaObjectDescription,
      parent,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
        ${key ?? ""}: z.object({})${
        parent?.required?.includes(key || "") ? "" : ".optional()"
      },`;
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
      schemaObject,
      schemaObjectEnum,
      schemaObjectDescription,
      parent,
      key,
    }) => {
      this.enumSchema.set(key, schemaObject);
      return `/**${schemaObjectDescription ?? ""}*/
      ${key}:${this.resolveEnumObject(schemaObjectEnum)}${
        parent?.required?.includes(key || "") ? "" : ".optional()"
      },`;
    };

    const baseOfNumber: ComponentSchema.BaseOfNumber = ({
      schemaObject,
      parent,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:${this.formatterBaseType(schemaObject)}${
        parent?.required?.includes(key || "") ? "" : ".optional()"
      },`;
    };
    const baseOfString: ComponentSchema.BaseOfString = ({
      schemaObject,
      parent,
      key,
    }) => {
      return `${this.getStringDescription(schemaObject)}
      ${key}:${this.formatterBaseType(schemaObject)}${
        parent?.required?.includes(key || "") ? "" : ".optional()"
      },`;
    };
    const baseOfBoolean: ComponentSchema.BaseOfBoolean = ({
      schemaObject,
      parent,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:${this.formatterBaseType(schemaObject)}${
        parent?.required?.includes(key || "") ? "" : ".optional()"
      },`;
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
    // z.enum(["Salmon", "Tuna", "Trout"])
    return Array.isArray(schemaObjectEnum)
      ? _.reduce(
          schemaObjectEnum,
          (result, value, index) => {
            result += `'${value}'${
              schemaObjectEnum?.length === index + 1 ? "])" : ","
            }`;
            return result;
          },
          "z.enum(["
        )
      : "";
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}Zod.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} zod write succeeded!`);
  }
}
