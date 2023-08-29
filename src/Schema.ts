import { ApiData, ComponentSchema } from "./types";
import { OpenAPIV3 } from "openapi-types";
import _ from "lodash";
import { OpenAPI } from "./OpenAPI";
import { errorLog } from "./log";

interface SchemaParams {
  schemaObject: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined;
  key?: string;
  parent?: OpenAPIV3.SchemaObject;
}

export class Schema {
  public apiItem: ApiData;
  public resolveRefCache: Set<string>;
  constructor(public openAPI: OpenAPI) {
    this.openAPI = openAPI;
    //已解析过的ref
    this.resolveRefCache = new Set();
  }
  get pendingRefCache() {
    return this.openAPI.pendingRefCache;
  }

  clearCache() {
    this.resolveRefCache.clear();
  }

  //todo 优化
  getComponent(
    ref: string = ""
  ): [
    component: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
    isCache: boolean
  ] {
    this.resolveRefCache.add(ref);
    const component = _.get(
      this.openAPI.openApi3SourceData,
      ref.split("/").slice(1).join(".")
    );
    return [component, this.resolveRefCache.has(ref)];
  }

  handleComponentSchema(
    { schemaObject, key, parent }: SchemaParams,
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
    }: ComponentSchema.SchemaCallBackGather
  ) {
    if (_.isNil(schemaObject)) return undefined;
    // 引用类型
    if ("$ref" in schemaObject && schemaObjectHas$Ref) {
      this.pendingRefCache.add(schemaObject.$ref);

      const [component] = this.getComponent(schemaObject.$ref) as [
        OpenAPIV3.SchemaObject,
        boolean
      ];
      return schemaObjectHas$Ref({ schemaObject, component, parent, key });
    }

    // 数组类型
    if (
      "type" in schemaObject &&
      schemaObject.type === "array" &&
      "$ref" in schemaObject.items
    ) {
      this.pendingRefCache.add(schemaObject.items.$ref);

      const [componentBySchemaObjectItemsRef] = this.getComponent(
        schemaObject.items.$ref
      );
      if (
        componentBySchemaObjectItemsRef &&
        "$ref" in componentBySchemaObjectItemsRef &&
        arraySchemaObjectItemsHas$RefOfComponent
      ) {
        this.pendingRefCache.add(componentBySchemaObjectItemsRef.$ref);

        const [component] = this.getComponent(
          componentBySchemaObjectItemsRef.$ref
        ) as [OpenAPIV3.SchemaObject, boolean];

        return arraySchemaObjectItemsHas$RefOfComponent({
          componentBySchemaObjectItemsRef,
          component,
          parent,
          key,
        });
      }

      if (
        arraySchemaObjectItemsHas$Ref &&
        !("$ref" in componentBySchemaObjectItemsRef)
      ) {
        return arraySchemaObjectItemsHas$Ref({
          $ref: schemaObject.items.$ref,
          schemaObjectTitle: schemaObject.title,
          componentBySchemaObjectItemsRef,
          parent,
          key,
        });
      }
    }

    //array 没有ref
    if (
      "type" in schemaObject &&
      schemaObject.type === "array" &&
      !("$ref" in schemaObject.items) &&
      arrayItemsNo$ref
    ) {
      return arrayItemsNo$ref({
        schemaObjectItems: schemaObject.items,
        schemaObjectDescription: schemaObject.description,
        parent,
        key,
      });
    }

    // 对象类型 properties 不存在
    if (
      "type" in schemaObject &&
      schemaObject.type === "object" &&
      !schemaObject.properties
    ) {
      return objectNotHaveProperties({
        schemaObjectDescription: schemaObject.description,
        parent,
        key,
      });
    }

    // 对象类型
    if (
      "type" in schemaObject &&
      schemaObject.type === "object" &&
      schemaObject.properties &&
      objectHasProperties
    ) {
      return objectHasProperties({
        schemaObject,
      });
    }

    // 枚举类型
    if (key && "enum" in schemaObject && schemaObject.enum && hasEnum) {
      return hasEnum({
        schemaObjectEnum: schemaObject.enum,
        schemaObjectDescription: schemaObject.description,
        parent,
        key,
      });
    }
    // 继承类型
    if (
      "allOf" in schemaObject &&
      schemaObject.allOf &&
      schemaObject.allOf.length
    ) {
      //todo 待补充
      errorLog("schemaObject.allOf");
      return "";
    }

    //基本类型
    if (
      "type" in schemaObject &&
      ["integer", "number"].includes(schemaObject.type || "")
    ) {
      return baseOfNumber({
        schemaObject,
        parent,
        key,
      });
    }

    if ("type" in schemaObject && schemaObject.type === "string") {
      return baseOfString({
        schemaObject,
        parent,
        key,
      });
    }

    if ("type" in schemaObject && schemaObject.type === "boolean") {
      return baseOfBoolean({
        schemaObject,
        parent,
        key,
      });
    }
    errorLog("schemaObject.type");
    return "";
  }
}
