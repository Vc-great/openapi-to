import _ from "lodash";

import type { Operation } from "oas/operation";
import type { OperationObject, ResponseObject, SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { OpenAPI } from "./OpenAPI.ts";
import type { GroupResponse, OpenAPIResponseObject } from "./types";

type ResponseRef = {
  $ref: string;
  tags: Array<string>;
  description: string | undefined;
};

export class Response {
  constructor(
    private operation: Operation,
    private openapi: OpenAPI,
  ) {
    this.operation = operation;
    this.openapi = openapi;
  }

  get getResponseStatusCodes() {
    return this.operation.getResponseStatusCodes();
  }

  /*  const codes = this.openapi.response?.getResponseStatusCodes || [];

  const successCode = (codes || []).filter((code: string) =>
    /^(2[0-9][0-9]|300)$/.test(code),
  );*/

  get successCode(): string {
    const codes = this.operation?.getResponseStatusCodes();

    return codes?.find((code) => code.startsWith("2")) || "";
  }

  getResponseAsJSONSchema(statusCode: string | number):
    | {
        description?: string;
        label: string;
        schema: SchemaObject;
        type: string | string[];
      }[]
    | undefined {
    return this.operation.getResponseAsJSONSchema(statusCode);
  }

  get successResponse(): OpenAPIResponseObject | undefined {
    const response:
      | ResponseObject
      | OpenAPIV3_1.ReferenceObject
      | OpenAPIV3.ReferenceObject
      | undefined = _.get(
      this.operation.schema.responses,
      this.successCode,
      undefined,
    );
    const ref: string = _.get(response, "$ref", "");

    if (ref) {
      const responseObject = this.openapi.findSchemaDefinition(
        ref,
      ) as ResponseObject;
      const mediaTypeObject =
        responseObject.content?.["application/json"] ||
        responseObject.content?.["*/*"];
      const schemaObject =
        mediaTypeObject?.schema &&
        "$ref" in mediaTypeObject.schema
          ? (this.openapi.findSchemaDefinition(
              mediaTypeObject?.schema.$ref,
            ) as SchemaObject)
          : (mediaTypeObject?.schema as SchemaObject);

      return {
        type: schemaObject?.type,
        description: responseObject?.description || undefined,
        schema: schemaObject,
        refName: _.last(_.get(mediaTypeObject, "schema.$ref", ref).split("/")),
      };
    }

    if (response && !("$ref" in response)) {
      const mediaTypeObject =
        response?.content?.["application/json"] || response?.content?.["*/*"];
      const schemaObject =
        mediaTypeObject?.schema &&
        "$ref" in mediaTypeObject.schema
          ? (this.openapi.findSchemaDefinition(
              mediaTypeObject?.schema.$ref,
            ) as SchemaObject)
          : (mediaTypeObject?.schema as SchemaObject);

      return {
        type:
          mediaTypeObject?.schema &&
          "$ref" in mediaTypeObject.schema
            ? undefined
            : schemaObject?.type,
        description: response?.description || undefined,
        schema: schemaObject,
        refName:
          _.last(_.get(mediaTypeObject, "schema.$ref", "").split("/")) ||
          undefined,
      };
    }

    return undefined;
  }

  /*  getResponseAsJSONSchema(statusCode: string | number): ResponseJSONSchema {
    const response:
      | ResponseObject
      | OpenAPIV3_1.ReferenceObject
      | OpenAPIV3.ReferenceObject
      | undefined = _.get(
      this.operation.schema.responses,
      statusCode,
      undefined,
    );

    //todo 保留response 中的ref 不再进行解析
    //若有ref 则判定复用schema 中的逻辑

    const ref: string = _.get(response, "$ref", "");

    if (ref) {
      const responseObject = this.openapi.findSchemaDefinition(
        ref,
      ) as ResponseObject;
      const mediaTypeObject =
        responseObject.content?.["application/json"] ||
        responseObject.content?.["*!/!*"];
      const schemaObject =
        mediaTypeObject &&
        mediaTypeObject.schema &&
        "$ref" in mediaTypeObject.schema
          ? (this.openapi.findSchemaDefinition(
              mediaTypeObject?.schema.$ref,
            ) as SchemaObject)
          : (mediaTypeObject?.schema as SchemaObject);

      return {
        type: schemaObject?.type || "any",
        description: responseObject?.description || undefined,
        schema: schemaObject,
        refName: _.last(_.get(mediaTypeObject, "schema.$ref", ref).split("/")),
      };
    }

    if (response && !("$ref" in response)) {
      const mediaTypeObject =
        response?.content?.["application/json"] || response?.content?.["*!/!*"];
      const schemaObject =
        mediaTypeObject &&
        mediaTypeObject.schema &&
        "$ref" in mediaTypeObject.schema
          ? (this.openapi.findSchemaDefinition(
              mediaTypeObject?.schema.$ref,
            ) as SchemaObject)
          : (mediaTypeObject?.schema as SchemaObject);

      return {
        type: schemaObject?.type || "any",
        description: response?.description || undefined,
        schema: schemaObject,
        refName:
          _.last(_.get(mediaTypeObject, "schema.$ref", "").split("/")) ||
          undefined,
      };
    }

    return {
      type: "any",
      description: undefined,
      schema: undefined,
      refName: undefined,
    };
  }*/

  //other media

  get isDownLoad() {
    const downLoadKey = ["download", "export"];
    return _.some(downLoadKey, (key) => this.operation.path.includes(key));
  }

  get groupResponsesByTag(): GroupResponse {
    const responses = this.operation.api.components?.responses;
    const responseRefs = _.chain(this.operation.api.paths)
      .map((pathObject, path) => {
        return _.chain(pathObject)
          .map((operationObject: OperationObject) => {
            const refs = _.chain(operationObject.responses)
              .map((item) => ("$ref" in item ? item.$ref : undefined))
              .filter(Boolean)
              .value();

            return {
              $ref: _.head(refs),
              tags: operationObject.tags,
              description: operationObject.description,
            };
          })
          .value() as unknown as Array<{ $ref: string; tags: string[] }>;
      })
      .flatten()
      .filter((item) => !!item.$ref)
      .value() as unknown as ResponseRef[];

    return _.chain(responseRefs)
      .reduce(
        (
          obj: {
            [k: string]: { tags: string[]; description: string | undefined };
          },
          { $ref, tags, description },
        ) => {
          obj[$ref] = {
            description: description,
            tags: obj[$ref]
              ? [
                  ...new Set(
                    ..._.chain([] as string[])
                      .concat(tags)
                      .concat(_.get(obj, `${$ref}.tags`, []) as string[])
                      .value(),
                  ),
                ]
              : [...new Set(tags)],
          };
          return obj;
        },
        {},
      )
      .reduce(
        (
          arr: {
            $ref: string;
            refName: string;
            tags: string[];
            description: string | undefined;
            responseObject: ResponseObject;
          }[],
          { tags, description },
          $ref,
        ) => {
          return [
            ...arr,
            {
              $ref,
              tags,
              description,
              refName: $ref.replace(/.+\//, ""),
              responseObject: this.openapi.findSchemaDefinition(
                $ref,
              ) as ResponseObject,
            },
          ];
        },
        [],
      )
      .value();
  }
}
