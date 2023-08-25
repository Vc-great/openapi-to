import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";
import type { ApiData } from "./types";
import { ParameterPath } from "./ParameterPath";
import { ParameterQuery } from "./ParameterQuery";
import { RequestBody } from "./RequestBody";
import { Response } from "./Response";
import { Component } from "./Component";

export class BaseData {
  public apiItem: ApiData;
  public path: ParameterPath;
  public query: ParameterQuery;
  public requestBody: RequestBody;
  public response: Response;
  public component: Component;
  constructor(public openApi3SourceData: OpenAPIV3.Document) {
    this.openApi3SourceData = openApi3SourceData;
    this.register();
  }

  register() {
    this.path = new ParameterPath();
    this.query = new ParameterQuery();
    this.requestBody = new RequestBody(this.openApi3SourceData);
    this.response = new Response();
    this.component = new Component(this.openApi3SourceData);
  }

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
    this.path.setApiItem(apiItem);
    this.query.setApiItem(apiItem);
    this.requestBody.setApiItem(apiItem);
    this.response.setApiItem(apiItem);
    this.component.setApiItem(apiItem);
  }
}
