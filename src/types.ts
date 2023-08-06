import { OpenAPIV3 } from "openapi-types";

export type ConfigTemplate = {
  projects: Project[];
};

export interface Project {
  title: string;
  path: string;
}

export interface Config {
  projectDir: string;
  title: string;
  path: string;
}

export interface ApiData extends OpenAPIV3.OperationObject {
  path: string;
  method: string;
  requestName: string;
}

export interface OpenApi3FormatData {
  [k: string]: ApiData;
}

export interface SchemaComponent {
  [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
}

export interface ParameterObject extends OpenAPIV3.ParameterBaseObject {
  name: string;
  in: string;
}

export type Parameters = (
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3.ParameterObject
)[];
//export type TagApiData = Record<string, APIDataType[]>;

export interface GenerateCode {
  run: (apiItem: ApiData) => any;
}

export type HttpMethods = ["get", "put", "post", "delete", "patch"];

export type HttpMethod = "get" | "put" | "post" | "delete" | "patch";

export const BaseType = ["boolean", "number", "string", "integer"];
