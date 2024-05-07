import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";

import type { Operation } from "oas/operation";
import type { MediaTypeObject } from "oas/types";
import type OasTypes from "oas/types";
import type { OpenAPI } from "./OpenAPI.ts";
import type {
  ArrayBody,
  GroupRequest,
  OpenAPIRequestBodyObject,
} from "./types.ts";
type RefBody = {
  $ref: string;
  tags: Array<string>;
};

export class RequestBody {
  constructor(
    private operation: Operation,
    private openapi: OpenAPI,
  ) {
    this.operation = operation;
    this.openapi = openapi;
  }

  get hasRequestBody(): boolean {
    return this.operation.hasRequestBody();
  }

  get isRequestBodyRequired(): boolean {
    return !!_.get(this.operation, "schema.requestBody.required");
  }

  get hasRef(): boolean {
    return !!_.get(this.operation, "schema.requestBody.$ref");
  }
  get ref(): string {
    return _.get(this.operation, "schema.requestBody.$ref", "");
  }

  get arrayBody(): ArrayBody {
    const requestBodyObject = this.requestBodyObject;
    const isArray = _.get(requestBodyObject, "schemaObject.type") === "array";
    const itemRef = _.get(requestBodyObject, "schemaObject.items.$ref", "");
    return {
      isArray,
      itemRefName: itemRef.replace(/.+\//, ""),
      itemRef,
      schemaObject: (this.openapi.findSchemaDefinition(itemRef) ||
        _.get(requestBodyObject, "schemaObject.items") ||
        requestBodyObject?.schemaObject) as OasTypes.SchemaObject,
    };
  }

  /**
   * Content-type :application/json or Content-typec: *
   */
  get isJsonContainsDefaultCases(): boolean {
    const isJson = this.operation.isJson();
    //no set type.the default is json
    const isNoContentType = this.operation.getContentType() === "*/*";
    return isJson || isNoContentType;
  }

  get isFormUrlEncoded(): boolean {
    return this.operation.isFormUrlEncoded();
  }

  get isMultipart(): boolean {
    return this.operation.isFormUrlEncoded();
  }

  get getContentType(): string {
    return this.operation.getContentType();
  }

  get requestBodyRefName(): string | undefined {
    const requestBody = this.operation.schema.requestBody;
    if (!requestBody) {
      return undefined;
    }
    if ("$ref" in requestBody) {
      return requestBody.$ref.replace(/.+\//, "");
    }

    const mediaType = _.head(_.keys(requestBody.content));
    const mediaTypeObject = _.get(requestBody.content, mediaType || "");

    //
    if (mediaTypeObject.schema && "$ref" in mediaTypeObject.schema) {
      return mediaTypeObject.schema.$ref.replace(/.+\//, "");
    }

    return this.arrayBody.itemRefName || undefined;
  }

  /**
   * return operation getRequestBody
   * @param mediaType
   */
  getRequestBodySchema(
    mediaType?: string,
  ): false | MediaTypeObject | [string, MediaTypeObject, ...string[]] {
    return this.operation.getRequestBody(mediaType);
  }

  get requestBodyObject(): OpenAPIRequestBodyObject | undefined {
    const requestBody = this.operation.schema.requestBody;

    //requestBodies
    if (requestBody && "$ref" in requestBody && requestBody.$ref) {
      const _requestBody = this.openapi.findSchemaDefinition(
        requestBody.$ref,
      ) as OasTypes.RequestBodyObject; //Pick<OpenAPIRequestBodyObject, "schemaObject">

      const mediaTypeObject =
        _requestBody.content?.["application/json"] ||
        _requestBody.content?.["*/*"];

      const schemaObject = mediaTypeObject?.schema ?? undefined;

      return {
        example: undefined,
        examples: undefined,
        description: _requestBody.description,
        refName: undefined, //requestBody.$ref.replace(/.+\//, ""),
        schemaObject: schemaObject,
      };
    }

    if (requestBody && "content" in requestBody) {
      const mediaTypeObject =
        requestBody.content?.["application/json"] ||
        requestBody.content?.["*/*"];

      const schemaObject = mediaTypeObject?.schema ?? undefined;

      return {
        example: mediaTypeObject?.example,
        examples: mediaTypeObject?.examples,
        description: requestBody.description || undefined,
        refName: undefined,
        schemaObject: schemaObject,
      };
    }

    return undefined;
  }

  get getRequestBodySchemaOfApplicationJson(): MediaTypeObject | undefined {
    const body = this.operation.getRequestBody("application/json");

    if (_.isBoolean(body)) {
      return undefined;
    }

    if (_.isArray(body)) {
      return body[1];
    }
    return body;
  }

  get groupRequestBodyByTag(): GroupRequest[] {
    const requestBodies = this.operation.api.components?.requestBodies;
    const refBody = _.chain(this.operation.api.paths)
      .map((pathObject, path) => {
        return _.chain(pathObject)
          .map((operationObject: OasTypes.OperationObject, method) => {
            if (
              !Object.keys(OpenAPIV3.HttpMethods)
                .map((item) => _.lowerCase(item))
                .includes(method)
            ) {
              return undefined;
            }
            return {
              ...operationObject.requestBody,
              tags: operationObject.tags,
            };
          })
          .filter(Boolean)
          .value() as unknown as Array<
          OasTypes.OperationObject & { tags: string[] }
        >;
      })
      .flatten()
      .filter((item) => !!item.$ref)
      .value() as unknown as RefBody[];

    return _.chain(refBody)
      .reduce((obj: { [k: string]: string[] }, { $ref, tags }) => {
        const ref = $ref;
        obj[ref] = obj[ref]
          ? [...new Set([...(obj[ref] || []), ...tags])]
          : [...new Set(tags)];
        return obj;
      }, {})
      .reduce((arr: GroupRequest[], tags, $ref) => {
        return [
          ...arr,
          {
            $ref,
            tags,
            refName: $ref.replace(/.+\//, ""),
            requestBodyObject: this.openapi.findSchemaDefinition(
              $ref,
            ) as OasTypes.RequestBodyObject,
          },
        ];
      }, [])
      .value();
  }

  /*getRequestBodySchema$2(): {
    refName: string | undefined;
    schema: OasTypes.SchemaObject | undefined;
  } {
    const requestBody = this.operation.schema.requestBody;
    if (!requestBody) {
      return {
        refName: undefined,
        schema: undefined,
      };
    }
    if ("$ref" in requestBody) {
      return {
        refName: requestBody.$ref.replace(/.+\//, ""),
        schema: findSchemaDefinition(
          requestBody.$ref,
          this.operation?.api,
        ) as OasTypes.SchemaObject,
      };
    }

    const mediaType = _.head(_.keys(requestBody.content));
    const mediaTypeObject = _.get(requestBody.content, mediaType || "");
    return {
      refName: undefined,
      schema: mediaTypeObject.schema,
    };
  }*/
}
