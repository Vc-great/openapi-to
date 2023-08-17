import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";
import { ApiData, OpenApi3FormatData } from "./types";
export class GenerateApi {
  constructor(
    public config: object,
    public openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    this.openApi3SourceData = openApi3SourceData;
    this.openApi3FormatData = openApi3FormatData;
    this.config = config;
  }

  generatorPath(apiItem: ApiData) {
    const path = apiItem.path.replace(/{([\w-]+)}/g, (matchData, params) => {
      return "${" + _.camelCase(params) + "}";
    });

    return "`" + path + "`";
  }

  getComponentByRef(ref) {
    return _.get(
      this.openApi3SourceData,
      ref.split("/").slice(1).join("."),
      undefined
    );
  }

  //summary中有下载或者导出 关键字 则增加type
  generateResponseType(summary: string) {
    const keys = ["下载", "导出"];
    return _.some(keys, (x) => summary.includes(x))
      ? `responseType:'blob'`
      : "";
  }
}
