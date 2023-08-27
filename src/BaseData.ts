import { OpenAPIV3 } from "openapi-types";
import type { ApiData, ApiNameCache } from "./types";
import { ParameterPath } from "./ParameterPath";
import { ParameterQuery } from "./ParameterQuery";
import { RequestBody } from "./RequestBody";
import { Response } from "./Response";
import { Schemas } from "./Schemas";

export class BaseData {
  public apiItem: ApiData;
  public path: ParameterPath;
  public query: ParameterQuery;
  public requestBody: RequestBody;
  public response: Response;
  public schemas: Schemas;
  apiNameCache: ApiNameCache;
  constructor(public openApi3SourceData: OpenAPIV3.Document) {
    this.openApi3SourceData = openApi3SourceData;
    this.apiNameCache = new Map();

    this.register();
  }

  register() {
    this.path = new ParameterPath(this);
    this.query = new ParameterQuery(this);
    this.requestBody = new RequestBody(this);
    this.response = new Response(this);
    this.schemas = new Schemas(this);
  }

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
  }
}
