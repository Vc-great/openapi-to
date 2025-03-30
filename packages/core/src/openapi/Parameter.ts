import _ from "lodash";
import { isRef } from "oas/types";
import { findSchemaDefinition } from "oas/utils";

import type { Operation } from "oas/operation";
import type {
  getParametersAsJSONSchemaOptions,
  SchemaWrapper,
} from "oas/operation/get-parameters-as-json-schema";
import type { SchemaObject } from "oas/types";
import type { ParameterObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { OpenAPIParameterObject } from "./types.ts";

type OasTypesParameterObject = ParameterObject & {
  $ref: string | undefined;
};

export class Parameter {
  constructor(private operation: Operation) {
    this.operation = operation;
  }

  // params路径参数
  get hasPathParameters(): boolean {
    return _.some(this.parameters, ["in", "path"]);
  }

  //
  get isQueryOptional(): boolean {
    const queryParameters = this.parametersOfQuery || [];
    return queryParameters.every((x) => !x.required);
  }

  get hasQueryParameters(): boolean {
    return _.some(this.parameters || [], ["in", "query"]);
  }

  get componentsParameters() {
    return _.chain(this.operation.api.components?.parameters)
      .map((item: OasTypesParameterObject, name: string) => {
        return {
          ...this.findSchema(item),
          refName: item.$ref?.replace(/.+\//, ""),
          $ref: item.$ref,
          key: name,
        };
      })
      .value() as unknown as OpenAPIParameterObject[];
  }

  get parameters(): OpenAPIParameterObject[] {
    return _.chain(this.operation.getParameters())
      .map((item: OasTypesParameterObject) => {
        return {
          ...this.findSchema(item),
          refName: item.$ref?.replace(/.+\//, ""),
          $ref: item.$ref,
        };
      })
      .value() as unknown as OpenAPIParameterObject[];
  }
  get parametersOfPath(): OpenAPIParameterObject[] {
    return _.chain(this.parameters).filter(["in", "path"]).value();
  }

  get parametersOfQuery(): Array<OpenAPIParameterObject> {
    return _.chain(this.parameters).filter(["in", "query"]).value();
  }

  findSchema(parameterObject: OasTypesParameterObject): ParameterObject {
    if ("$ref" in parameterObject && parameterObject.$ref) {
      return findSchemaDefinition(
        parameterObject.$ref,
        this.operation?.api,
      ) as ParameterObject;
    }
    return parameterObject;
  }

  getParametersAsJSONSchema(
    opts?: getParametersAsJSONSchemaOptions,
  ): SchemaWrapper[] {
    return this.operation.getParametersAsJSONSchema(opts);
  }

  get parametersName(): string {
    return _.chain(this.parameters || [])
      .filter(["in", "path"])
      .filter((item) => !!item.name)
      .map((parameter) => {
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
        return `\${${_.camelCase(pathParams)}}`;
      },
    );
    return `\`${path}\``;
  }

  getParametersSchema(inKey: "path" | "query" | "header"): SchemaObject | null {
    const params = _.chain(this.parameters)
      .filter(["in", inKey])
      .map((item) => {
        const parameter = item as unknown as OpenAPIV3.ReferenceObject &
          ParameterObject;
        if (isRef(parameter)) {
          return findSchemaDefinition(
            parameter.$ref,
            this.operation.api,
          ) as ParameterObject;
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
          (pathParameters.schema as SchemaObject);

        const required = [
          ...(schema.required || ([] as any)),
          pathParameters.required ? pathParameters.name : undefined,
        ].filter(Boolean);

        return {
          ...schema,
          required,
          properties: {
            ...schema.properties,
            [inKey === "path"
              ? _.camelCase(pathParameters.name)
              : pathParameters.name]: {
              description: pathParameters.description,
              ...property,
            },
          },
        };
      },
      { type: "object", required: [], properties: {} } as SchemaObject,
    );
  }
}
