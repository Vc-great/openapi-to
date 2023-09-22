import { OpenAPIV3 } from "openapi-types";
import type { ApiData, ApiNameCache, Config } from "./types";
import { ParameterPath } from "./ParameterPath";
import { ParameterQuery } from "./ParameterQuery";
import { RequestBody } from "./RequestBody";
import { Response } from "./Response";
import { Schema } from "./Schema";
import _ from "lodash";

export class OpenAPI {
  public apiItem: ApiData;
  public path: ParameterPath;
  public query: ParameterQuery;
  public requestBody: RequestBody;
  public response: Response;
  public schemas: Schema;
  apiNameCache: ApiNameCache;
  pendingRefCache: Set<string>;

  constructor(
    public openApi3SourceData: OpenAPIV3.Document,
    public config: Config
  ) {
    this.openApi3SourceData = openApi3SourceData;
    this.config = config;
    this.apiNameCache = new Map();
    //缓存$ref
    this.pendingRefCache = new Set();

    this.path = new ParameterPath(this);
    this.query = new ParameterQuery(this);
    this.requestBody = new RequestBody(this);
    this.response = new Response(this);
    this.schemas = new Schema(this);
  }

  get queryRequestName() {
    return `${_.upperFirst(this.apiItem.requestName)}QueryRequest`;
  }
  get pathRequestName() {
    return `${_.upperFirst(this.apiItem.requestName)}PathRequest`;
  }
  get bodyRequestName() {
    return `${_.upperFirst(this.apiItem.requestName)}BodyRequest`;
  }
  get responseName() {
    return `${_.upperFirst(this.apiItem.requestName)}Response`;
  }

  get lowerFirstQueryRequestName() {
    return _.lowerFirst(this.queryRequestName);
  }

  get lowerFirstPathRequestName() {
    return _.lowerFirst(this.pathRequestName);
  }

  get lowerFirstBodyRequestName() {
    return _.lowerFirst(this.bodyRequestName);
  }

  get lowFirstResponseName() {
    return _.lowerFirst(this.responseName);
  }
}
