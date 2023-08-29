import type {
  ApiData,
  ArrayItems,
  BaseType,
  ComponentSchema,
  Config,
  GenerateCode,
  HandleComponent,
  OpenApi3FormatData,
  RefHasCache,
} from "./types";
import { OpenAPIV3 } from "openapi-types";
import { OpenAPI } from "./OpenAPI";
import _ from "lodash";
import {
  formatterBaseType,
  numberEnum,
  prettierFile,
  stringEnum,
} from "./utils";
import { errorLog, successLog } from "./log";
import fse from "fs-extra";
import path from "path";

export class GenerateRequestObject extends OpenAPI implements GenerateCode {
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

  public run(tagItem: ApiData[]) {
    //每一轮tag 清空cache
    this.pendingRefCache.clear();
    this.schemas.clearCache();
    this.apiNameCache.clear();

    const tagItemTypeString = tagItem
      .map((apiItem) => {
        this.apiItem = apiItem;
        const types = [
          this.getQueryParams(),
          this.getRequestBodyParams(apiItem),
        ];
        const filterEmpty = (types: string[]) => types.filter((type) => type);
        const addLineFeed = (types: string[]) => types.join("\n");

        return _.flow([filterEmpty, addLineFeed])(types);
      })
      .join("\n");

    return {
      title: _.get(_.head(tagItem), "tags[0]", ""),
      codeString: prettierFile(tagItemTypeString),
    };
  }

  getQueryParams() {
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
    if (!["post", "put"].includes(apiItem.method)) {
      return "";
    }
    const refHasCache: RefHasCache = (interfaceName, $ref) => {
      return `/** ${apiItem.summary ?? ""} */
      const ${interfaceName} = ${this.apiNameCache.get($ref)}`;
    };

    const arrayItems: ArrayItems = (interfaceName) => {
      return `/** ${apiItem.summary} */
      const ${interfaceName} = []`;
    };

    const baseType: BaseType = (interfaceName, component) => {
      return `/** ${apiItem.summary} */
            const ${interfaceName} = ${formatterBaseType(component)}`;
    };

    const handleComponent: HandleComponent = (interfaceName, component) => {
      const typeString = this.handleComponentSchema(component);

      const bodyType = `/** ${apiItem.summary ?? ""} */
            const ${interfaceName} = {
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

  handleComponentSchema(
    schemaObject:
      | OpenAPIV3.SchemaObject
      | OpenAPIV3.ReferenceObject
      | undefined,
    key?: string,
    parent?: OpenAPIV3.SchemaObject
  ) {
    const schemaObjectHas$Ref: ComponentSchema.SchemaObjectHas$Ref = ({
      component,
      key,
    }) => {
      return `/**${component.title ?? ""}*/
      ${key}:${component.type === "array" ? "[]," : "'',"}`;
    };
    const arraySchemaObjectItemsHas$Ref: ComponentSchema.ArraySchemaObjectItemsHas$Ref =
      ({ componentBySchemaObjectItemsRef }) => {
        return `/**${componentBySchemaObjectItemsRef.title ?? ""}*/
        ${key}:[],`;
      };
    const arrayItemsNo$ref: ComponentSchema.ArrayItemsNo$ref = ({
      schemaObjectDescription,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
      ${key ?? ""}:[],`;
    };
    const objectNotHaveProperties: ComponentSchema.ObjectNotHaveProperties = ({
      schemaObjectDescription,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
        ${key ?? ""}: {},`;
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
      schemaObjectDescription,
      key,
    }) => {
      return `/**${schemaObjectDescription ?? ""}*/
      ${key}:'',`;
    };

    const baseOfNumber: ComponentSchema.BaseOfNumber = ({
      schemaObject,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:0,`;
    };
    const baseOfString: ComponentSchema.BaseOfString = ({
      schemaObject,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:'',`;
    };
    const baseOfBoolean: ComponentSchema.BaseOfBoolean = ({
      schemaObject,
      key,
    }) => {
      return `/**${schemaObject.description ?? ""}*/
      ${key}:false,`;
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

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}RequestObject.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} requestObject write succeeded!`);
  }
}