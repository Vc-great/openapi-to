import _ from "lodash";

import type { Operation } from "oas/operation";
import type OasTypes from "oas/types";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type { OpenAPI } from "./OpenAPI.ts";
import type { ParseRef } from "./types.ts";

export class Schema {
  constructor(
    private operation: Operation,
    private openapi: OpenAPI,
  ) {
    this.operation = operation;
    this.openapi = openapi;
  }

  get oas() {
    return this.openapi.oas;
  }

  get version(): string {
    return this.openapi.oas.getVersion();
  }

  get isOpenAPIV3(): boolean {
    return this.version.startsWith("3.0");
  }

  get isOpenAPIV3_1(): boolean {
    return this.version.startsWith("3.1");
  }

  parseSchema(
    schema: OasTypes.SchemaObject,
  ): OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject {
    if (this.isOpenAPIV3) {
      return schema as OpenAPIV3.SchemaObject;
    }

    return schema as OpenAPIV3_1.SchemaObject;
  }

  parseRef(ref: string): ParseRef {
    const componentName: string = ref.replace(/.+\//, "");

    const isRequestBodies = ref
      .split("/")
      .some((str) => str === "requestBodies");

    const schemaPath = isRequestBodies
      ? "requestBodies." + componentName
      : "schemas." + componentName;

    const schema = _.get(this.oas.api.components, schemaPath, undefined) as
      | OpenAPIV3.SchemaObject
      | OpenAPIV3_1.SchemaObject
      | OpenAPIV3_1.RequestBodyObject
      | OpenAPIV3.RequestBodyObject
      | undefined;
    if (schema === undefined) {
      return {
        ref,
        componentName,
        schema: undefined,
        type: "",
      };
    }

    //SchemaObject
    if ("type" in schema) {
      return {
        ref,
        componentName,
        schema,
        type: "",
      };
    }

    // RequestBodyObject
    if ("content" in schema && schema.content) {
      const mediaTypeObject = _.get(
        schema.content,
        "application/json",
        undefined,
      );

      if (
        mediaTypeObject &&
        "schema" in mediaTypeObject &&
        mediaTypeObject.schema &&
        "$ref" in mediaTypeObject.schema
      ) {
        return this.parseRef(mediaTypeObject.schema.$ref);
      }

      if (
        mediaTypeObject &&
        "schema" in mediaTypeObject &&
        mediaTypeObject.schema &&
        "type" in mediaTypeObject.schema
      ) {
        return {
          ref,
          componentName,
          schema: mediaTypeObject.schema,
          type: "",
        };
      }
    }

    return {
      ref,
      componentName,
      schema: undefined,
      type: "",
    };
  }
}
