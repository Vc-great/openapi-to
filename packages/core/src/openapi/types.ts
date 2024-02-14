import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export type ParseRef = {
  ref: string;
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject | undefined;
  componentName: string;
  type: string;
};
