import _ from "lodash";

import type { Operation } from "oas/operation";
import type { ParameterObject } from "oas/types";
export class Parameter {
  constructor(private operation: Operation) {
    this.operation = operation;
  }

  // params路径参数
  get hasPathParameters(): boolean {
    return _.some(this.parameters, ["in", "path"]);
  }

  get hasQueryParameters(): boolean {
    return _.some(this.parameters || [], ["in", "query"]);
  }

  get parameters(): ParameterObject[] {
    return this.operation.getParameters();
  }

  get parametersName(): string {
    return _.chain(this.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}`;
      })
      .join()
      .value();
  }

  get hasQueryParametersArray(): boolean {
    return _.some(
      this.parameters,
      (parameter) =>
        "schema" in parameter &&
        parameter.schema &&
        "type" in parameter.schema &&
        parameter.schema.type === "array",
    );
  }

  get url(): string {
    const path = this.operation.path.replace(
      /{([\w-]+)}/g,
      (_matchData, pathParams: string) => {
        return "${" + _.camelCase(pathParams) + "}";
      },
    );
    return "`" + path + "`";
  }
}
