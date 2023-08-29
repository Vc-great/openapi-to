import _ from "lodash";
import { OpenAPI } from "./OpenAPI";

export class ParameterQuery {
  constructor(public openAPI: OpenAPI) {
    this.openAPI = openAPI;
  }

  get hasQueryParameters() {
    return _.some(this.openAPI.apiItem.parameters || [], ["in", "query"]);
  }

  get parameters() {
    return _.filter(this.openAPI.apiItem.parameters || [], ["in", "query"]);
  }

  get hasQueryArrayParameters() {
    return _.some(
      this.openAPI.apiItem.parameters,
      (parameter) =>
        "schema" in parameter &&
        parameter.schema &&
        "type" in parameter.schema &&
        parameter.schema.type === "array"
    );
  }
  getQueryByParameters() {}
}
