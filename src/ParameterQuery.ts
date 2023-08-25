import { ApiData } from "./types";
import _ from "lodash";

export class ParameterQuery {
  public apiItem: ApiData;
  constructor() {}

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
  }

  get hasQueryParameters() {
    return _.some(this.apiItem.parameters || [], ["in", "query"]);
  }

  get parameters() {
    return _.filter(this.apiItem.parameters || [], ["in", "query"]);
  }

  get hasQueryArrayParameters() {
    return _.some(
      this.apiItem.parameters,
      (parameter) =>
        "schema" in parameter &&
        parameter.schema &&
        "type" in parameter.schema &&
        parameter.schema.type === "array"
    );
  }
  getQueryByParameters() {}
}
