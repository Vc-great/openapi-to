import _ from "lodash";
import { BaseData } from "./BaseData";

export class ParameterQuery {
  constructor(public baseData: BaseData) {
    this.baseData = baseData;
  }

  get hasQueryParameters() {
    return _.some(this.baseData.apiItem.parameters || [], ["in", "query"]);
  }

  get parameters() {
    return _.filter(this.baseData.apiItem.parameters || [], ["in", "query"]);
  }

  get hasQueryArrayParameters() {
    return _.some(
      this.baseData.apiItem.parameters,
      (parameter) =>
        "schema" in parameter &&
        parameter.schema &&
        "type" in parameter.schema &&
        parameter.schema.type === "array"
    );
  }
  getQueryByParameters() {}
}
