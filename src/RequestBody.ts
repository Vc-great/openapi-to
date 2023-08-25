import { ApiData } from "./types";
import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";

export class RequestBody {
  public apiItem: ApiData;
  constructor(public openApi3SourceData: OpenAPIV3.Document) {
    this.openApi3SourceData = openApi3SourceData;
  }

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
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

  component(
    ref: string = "",
    refsCache: Array<string> = []
  ): [undefined | OpenAPIV3.SchemaObject, string[]] {
    const schemaComponent = this.getComponentByRef(ref);

    if (schemaComponent === undefined) {
      return [undefined, refsCache];
    }

    if ("$ref" in schemaComponent) {
      return this.component(schemaComponent.$ref, [
        ...refsCache,
        schemaComponent.$ref,
      ]);
    }

    if ("content" in schemaComponent) {
      const media = _.chain(schemaComponent.content).values().head().value();

      if (media.schema && "$ref" in media.schema) {
        return this.component(media.schema.$ref, [
          ...refsCache,
          media.schema.$ref,
        ]);
      }

      if (
        media.schema &&
        media.schema.type === "array" &&
        "$ref" in media.schema.items
      ) {
        return this.component(media.schema.items.$ref, [
          ...refsCache,
          media.schema.items.$ref,
        ]);
      }

      return [media.schema, refsCache];
    }
    return [schemaComponent, refsCache];
  }

  getComponentByRef(
    ref: string = ""
  ):
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3.SchemaObject
    | undefined {
    return _.get(this.openApi3SourceData, ref.split("/").slice(1).join("."));
  }
}
