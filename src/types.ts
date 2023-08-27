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
  output: string;
  title: string;
  path: string;
}

export interface ApiData extends OpenAPIV3.OperationObject {
  path: string;
  method: string;
  requestName: string;
}

export interface OpenApi3FormatData {
  [k: string]: ApiData[];
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
  run: (tagItem: ApiData[]) => void;
}

export type HttpMethods = ["get", "put", "post", "delete", "patch"];

export type HttpMethod = "get" | "put" | "post" | "delete" | "patch";

export type ApiNameCache = Map<string, string>;

export type RefHasCache = (typeName: string, $ref: string) => string;
export type ArrayItems = (
  typeName: string,
  items: OpenAPIV3.SchemaObject
) => string;
export type BaseType = (
  typeName: string,
  component: OpenAPIV3.SchemaObject
) => string;
export type HandleComponent = (
  typeName: string,
  component: OpenAPIV3.SchemaObject
) => string;
export interface RequestBodyParams {
  refHasCache: RefHasCache;
  arrayItems: ArrayItems;
  baseType: BaseType;
  handleComponent: HandleComponent;
}
