import _ from "lodash";
import { OpenAPI } from "./OpenAPI";

export class Path {
  constructor(public OpenAPI: OpenAPI) {
    this.OpenAPI = OpenAPI;
  }
  // params路径参数
  get hasPathParameters() {
    return _.some(this.OpenAPI.apiItem.parameters, ["in", "path"]);
  }

  get parameters() {
    return _.filter(this.OpenAPI.apiItem.parameters, ["in", "path"]);
  }

  get parametersName() {
    return _.chain(this.OpenAPI.apiItem.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  get url() {
    const path = this.OpenAPI.apiItem.path.replace(
      /{([\w-]+)}/g,
      (matchData, params) => {
        return "${" + _.camelCase(params) + "}";
      }
    );

    return "`" + path + "`";
  }
}
