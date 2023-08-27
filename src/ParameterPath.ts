import _ from "lodash";
import { BaseData } from "./BaseData";

export class ParameterPath {
  constructor(public baseData: BaseData) {
    this.baseData = baseData;
  }
  // params路径参数
  get hasPathParameters() {
    return _.some(this.baseData.apiItem.parameters, ["in", "path"]);
  }

  get parameters() {
    return _.filter(this.baseData.apiItem.parameters, ["in", "path"]);
  }

  get parametersName() {
    return _.chain(this.baseData.apiItem.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  get url() {
    const path = this.baseData.apiItem.path.replace(
      /{([\w-]+)}/g,
      (matchData, params) => {
        return "${" + _.camelCase(params) + "}";
      }
    );

    return "`" + path + "`";
  }
}
