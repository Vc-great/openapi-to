import type { JSONSchema4TypeName, JSONSchema7TypeName } from "json-schema";
import type {
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from "oas/types";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export type ParseRef = {
  ref: string;
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject | undefined;
  componentName: string;
  type: string;
};

export type OpenAPIParameterObject = ParameterObject & {
  refName: string | undefined;
  $ref: string | undefined;
  key: string;
};

export type GroupRequest = {
  $ref: string;
  tags: string[];
  refName: string;
  requestBodyObject: RequestBodyObject;
};

export type OpenAPIRequestBodyObject = {
  example: any;
  examples:
    | Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3.ExampleObject>
    | { [p: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject }
    | undefined;
  description: string | undefined;
  refName: string | undefined;
  schemaObject:
    | SchemaObject
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3_1.ReferenceObject
    | undefined;
};

export interface OpenAPIResponseObject {
  description: string | undefined;
  schema: SchemaObject | undefined;
  refName: string | undefined;
  type:
    | OpenAPIV3.ArraySchemaObjectType
    | OpenAPIV3_1.NonArraySchemaObjectType
    | JSONSchema4TypeName
    | JSONSchema4TypeName[]
    | undefined
    | JSONSchema7TypeName
    | JSONSchema7TypeName[];
}

export type GroupResponse = {
  $ref: string;
  refName: string;
  tags: string[];
  responseObject: ResponseObject;
}[];

export type ArrayBody = {
  isArray: boolean;
  itemRefName: string;
  itemRef: string;
  schemaObject: SchemaObject;
};
