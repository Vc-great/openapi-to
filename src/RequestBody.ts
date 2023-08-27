import { RequestBodyParams } from "./types";
import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";
import { baseDataType } from "./utils";
import { BaseData } from "./BaseData";

export class RequestBody {
  constructor(public baseData: BaseData) {
    this.baseData = baseData;
  }

  get apiItem() {
    return this.baseData.apiItem;
  }

  get apiNameCache() {
    return this.baseData.apiNameCache;
  }

  get openApi3SourceData() {
    return this.baseData.openApi3SourceData;
  }

  get hasRequestBodyParams() {
    if (this.apiItem.requestBody && "$ref" in this.apiItem.requestBody) {
      return true;
    }

    if (this.apiItem.requestBody && "content" in this.apiItem.requestBody) {
      const media = _.chain(this.apiItem.requestBody.content)
        .values()
        .head()
        .value();
      if (!_.isEmpty(media)) {
        return true;
      }
      return false;
    }
  }

  public getComponent(
    ref: string = "",
    refsCache: Array<string> = []
  ): [undefined | OpenAPIV3.SchemaObject, string[]] {
    const schemaComponent = this.getComponentByRef(ref);

    if (schemaComponent === undefined) {
      return [undefined, refsCache];
    }

    if ("$ref" in schemaComponent) {
      return this.getComponent(schemaComponent.$ref, [
        ...refsCache,
        schemaComponent.$ref,
      ]);
    }

    if ("content" in schemaComponent) {
      const media = _.chain(schemaComponent.content).values().head().value();

      if (media.schema && "$ref" in media.schema) {
        return this.getComponent(media.schema.$ref, [
          ...refsCache,
          media.schema.$ref,
        ]);
      }

      if (
        media.schema &&
        media.schema.type === "array" &&
        "$ref" in media.schema.items
      ) {
        return this.getComponent(media.schema.items.$ref, [
          ...refsCache,
          media.schema.items.$ref,
        ]);
      }

      return [media.schema, refsCache];
    }
    return [schemaComponent, refsCache];
  }

  private getComponentByRef(
    ref: string = ""
  ):
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3.SchemaObject {
    return _.get(this.openApi3SourceData, ref.split("/").slice(1).join("."));
  }

  public getParams({
    refHasCache,
    arrayItems,
    baseType,
    handleComponent,
  }: RequestBodyParams) {
    if (!this.apiItem.requestBody) {
      return "";
    }
    const interfaceName = `${_.upperFirst(
      this.apiItem.requestName
    )}BodyRequest`;
    //已经解析过采用继承的方式
    if (
      "$ref" in this.apiItem.requestBody &&
      this.apiNameCache.has(this.apiItem.requestBody.$ref)
    ) {
      return refHasCache(interfaceName, this.apiItem.requestBody.$ref);
    }

    let component;

    if ("$ref" in this.apiItem.requestBody) {
      const [resolveComponent, resolveRefs] = this.getComponent(
        this.apiItem.requestBody.$ref
      );

      component = resolveComponent;
      [...resolveRefs, this.apiItem.requestBody.$ref].forEach((ref) =>
        this.apiNameCache.set(ref, interfaceName)
      );
    }

    if (
      !component &&
      "content" in this.apiItem.requestBody &&
      this.apiItem.requestBody.content
    ) {
      const media = _.chain(this.apiItem.requestBody.content)
        .values()
        .head()
        .value();

      if (media.schema && "$ref" in media.schema) {
        const [resolveComponent, resolveRefs] = this.getComponent(
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
      return arrayItems(interfaceName, component);
    }

    //容错 请求body不应该是基本类型
    if (baseDataType.includes(component.type || "")) {
      return baseType(interfaceName, component);
    }
    return handleComponent(interfaceName, component);
  }
}
