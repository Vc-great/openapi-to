import _ from "lodash";
import { OpenAPI } from "./OpenAPI";

export class ParameterPath {
  constructor(public openAPI: OpenAPI) {
    this.openAPI = openAPI;
  }
  // params路径参数
  get hasPathParameters() {
    return _.some(this.openAPI.apiItem.parameters, ["in", "path"]);
  }

  get parameters() {
    return _.filter(this.openAPI.apiItem.parameters, ["in", "path"]);
  }

  get parametersName() {
    return _.chain(this.openAPI.apiItem.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  get url() {
    const path = this.openAPI.apiItem.path.replace(
      /{([\w-]+)}/g,
      (matchData, params) => {
        return "${" + _.camelCase(params) + "}";
      }
    );

    return "`" + path + "`";
  }
}
