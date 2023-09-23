import { OpenAPIV3 } from "openapi-types";
import type { ApiData, ApiNameCache, Config, Parameter } from "./types";
import { Path } from "./Path";
import { Query } from "./Query";
import { RequestBody } from "./RequestBody";
import { Response } from "./Response";
import { Schema } from "./Schema";
import _ from "lodash";

export class OpenAPI {
  public apiItem: ApiData;
  public path: Path;
  public query: Query;
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

    this.path = new Path(this);
    this.query = new Query(this);
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

  traverseParameters(
    parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[],
    {
      has$ref,
      $refInItemSchema,
      other,
    }: {
      has$ref?: Parameter.has$ref;
      $refInItemSchema?: Parameter.$refInItemSchema;
      other: Parameter.other;
    }
  ) {
    if (!parameters) {
      return "";
    }
    const itemTypeMap = (
      parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
    ): (string | undefined)[] => {
      return _.map(parameters, (item) => {
        if ("$ref" in item) {
          //todo
          return has$ref && has$ref(item.$ref);
        }

        if (item.schema && "$ref" in item.schema) {
          //todo
          return (
            $refInItemSchema &&
            $refInItemSchema({ item, $ref: item.schema.$ref })
          );
        }

        return other && other({ item, schema: item.schema });
      });
    };
    const joinItem = (itemTypeMap: string[]) => _.join(itemTypeMap, "\n");
    const filterItem = (itemTypeMap: (string | undefined)[]) =>
      _.filter(itemTypeMap, (x: string | undefined) => x);
    return _.flow(itemTypeMap, filterItem, joinItem)(parameters);
  }
}
