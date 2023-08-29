import { OpenAPIV3 } from "openapi-types";
import type { ApiData, ApiNameCache } from "./types";
import { ParameterPath } from "./ParameterPath";
import { ParameterQuery } from "./ParameterQuery";
import { RequestBody } from "./RequestBody";
import { Response } from "./Response";
import { Schema } from "./Schema";

export class OpenAPI {
  public apiItem: ApiData;
  public path: ParameterPath;
  public query: ParameterQuery;
  public requestBody: RequestBody;
  public response: Response;
  public schemas: Schema;
  apiNameCache: ApiNameCache;
  pendingRefCache: Set<string>;

  constructor(public openApi3SourceData: OpenAPIV3.Document) {
    this.openApi3SourceData = openApi3SourceData;
    this.apiNameCache = new Map();
    //缓存$ref
    this.pendingRefCache = new Set();

    this.path = new ParameterPath(this);
    this.query = new ParameterQuery(this);
    this.requestBody = new RequestBody(this);
    this.response = new Response(this);
    this.schemas = new Schema(this);
  }
}
