import _ from "lodash";
import { isRef } from "oas/types";
import { findSchemaDefinition } from "oas/utils";

import type { Operation } from "oas/operation";
import type {
  getParametersAsJSONSchemaOptions,
  SchemaWrapper,
} from "oas/operation/get-parameters-as-json-schema";
import type { ParameterObject } from "oas/types";
import type OasTypes from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
export class Parameter {
  constructor(private operation: Operation) {
    this.operation = operation;
  }

  // params路径参数
  get hasPathParameters(): boolean {
    return _.some(this.parameters, ["in", "path"]);
  }

  get hasQueryParameters(): boolean {
    return _.some(this.parameters || [], ["in", "query"]);
  }

  get parameters(): ParameterObject[] {
    return this.operation.getParameters();
  }
  get parametersOfPath(): ParameterObject[] {
    return _.chain(this.parameters).filter(["in", "path"]).value();
  }

  get parametersOfQuery(): ParameterObject[] {
    return _.chain(this.parameters).filter(["in", "query"]).value();
  }

  getParametersAsJSONSchema(
    opts?: getParametersAsJSONSchemaOptions,
  ): SchemaWrapper[] {
    return this.operation.getParametersAsJSONSchema(opts);
  }

  get parametersName(): string {
    return _.chain(this.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  get hasQueryParametersArray(): boolean {
    return _.some(
      this.parameters,
      (parameter) =>
        "schema" in parameter &&
        parameter.schema &&
        "type" in parameter.schema &&
        parameter.schema.type === "array",
    );
  }

  get url(): string {
    const path = this.operation.path.replace(
      /{([\w-]+)}/g,
      (_matchData, pathParams: string) => {
        return "${" + _.camelCase(pathParams) + "}";
      },
    );
    return "`" + path + "`";
  }

  getParametersSchema(
    inKey: "path" | "query" | "header",
  ): OasTypes.SchemaObject | null {
    const params = _.chain(this.parameters)
      .filter(["in", inKey])
      .map((item) => {
        const parameter = item as unknown as OpenAPIV3.ReferenceObject &
          OasTypes.ParameterObject;
        if (isRef(parameter)) {
          return findSchemaDefinition(
            parameter.$ref,
            this.operation.api,
          ) as OasTypes.ParameterObject;
        }

        return parameter;
      })
      .value();

    if (!params.length) {
      return null;
    }

    return params.reduce(
      (schema, pathParameters) => {
        const property =
          pathParameters.content?.[this.operation.getContentType()]?.schema ??
          (pathParameters.schema as OasTypes.SchemaObject);

        const required = [
          ...(schema.required || ([] as any)),
          pathParameters.required ? pathParameters.name : undefined,
        ].filter(Boolean);

        return {
          ...schema,
          required,
          properties: {
            ...schema.properties,
            [pathParameters.name]: {
              //description: pathParameters.description,
              ...property,
            },
          },
        };
      },
      { type: "object", required: [], properties: {} } as OasTypes.SchemaObject,
    );
  }
}
