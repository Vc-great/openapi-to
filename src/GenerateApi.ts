import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";
import type { ApiData } from "./types";

export class GenerateApi {
  public apiItem: ApiData;
  constructor(public openApi3SourceData: OpenAPIV3.Document) {
    this.openApi3SourceData = openApi3SourceData;
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

  // params路径参数
  get hasPathParameters() {
    return _.some(this.apiItem.parameters, ["in", "path"]);
  }

  //query 查询参数
  get hasQueryParameters() {
    return _.some(this.apiItem.parameters, ["in", "query"]);
  }

  get hasRequestBodyParams() {
    if (this.apiItem.requestBody && "$ref" in this.apiItem.requestBody) {
      return true;
    }

    if (this.apiItem.requestBody && "content" in this.apiItem.requestBody) {
      const media = _.chain(this.apiItem.requestBody.content)
        .values()
        .head()
        .value();
      if (!_.isEmpty(media)) {
        return true;
      }
      return false;
    }
  }

  /**
   *
   * @param type ts传递类型,js不传
   */
  getParamsSerializer(type?: string) {
    return this.hasQueryArrayParameters
      ? `paramsSerializer(params${type ? ":" + type : ""}) {
            return qs.stringify(params)
        }`
      : "";
  }

  //上传文件
  generateUploadFormData(apiItem: ApiData) {
    const uploadFormDataHeader = `headers: { 'Content-Type': 'multipart/form-data' }`;
    const uploadFormData = `//todo 上传文件
    const formData = new FormData();
    formData.append("file", file);`;

    if (apiItem.requestBody && "$ref" in apiItem.requestBody) {
      const component: OpenAPIV3.RequestBodyObject = _.get(
        this.openApi3SourceData,
        apiItem.requestBody.$ref.split("/").slice(1).join(".")
      );
      if (component.content && "multipart/form-data" in component.content) {
        return {
          formDataHeader: uploadFormDataHeader,
          uploadFormData,
        };
      }
    }

    if (
      apiItem.requestBody &&
      "content" in apiItem.requestBody &&
      "multipart/form-data" in apiItem.requestBody.content
    ) {
      return {
        formDataHeader: uploadFormDataHeader,
        uploadFormData,
      };
    }

    return {
      formDataHeader: "",
      uploadFormData: "",
    };
  }

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
  }

  generatorPath(apiItem: ApiData) {
    const path = apiItem.path.replace(/{([\w-]+)}/g, (matchData, params) => {
      return "${" + _.camelCase(params) + "}";
    });

    return "`" + path + "`";
  }

  //summary中有下载或者导出 关键字 则增加type
  downLoadResponseType() {
    const keys = ["下载", "导出"];
    return _.some(keys, (x) => this.apiItem.summary?.includes(x))
      ? `responseType:'blob'`
      : "";
  }
}
