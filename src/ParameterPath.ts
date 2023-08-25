import _ from "lodash";
import { ApiData } from "./types";

export class ParameterPath {
  public apiItem: ApiData;
  constructor() {}

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
  }

  // params路径参数
  get hasPathParameters() {
    return _.some(this.apiItem.parameters, ["in", "path"]);
  }

  get parameters() {
    return _.filter(this.apiItem.parameters, ["in", "path"]);
  }

  get parametersName() {
    return _.chain(this.apiItem.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  get url() {
    const path = this.apiItem.path.replace(
      /{([\w-]+)}/g,
      (matchData, params) => {
        return "${" + _.camelCase(params) + "}";
      }
    );

    return "`" + path + "`";
  }
}
