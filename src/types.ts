import { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

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

//export type TagApiData = Record<string, APIDataType[]>;

export interface GenerateCode {
  run: (apiItem: ApiData) => any;
}

export type HttpMethods = ["get", "put", "post", "delete", "patch"];

export type HttpMethod = "get" | "put" | "post" | "delete" | "patch";
