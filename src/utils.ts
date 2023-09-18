import prettier from "prettier";
import type { ApiData, HttpMethods } from "./types";
import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";
import { errorLog } from "./log";

export const prettierFile = (content: string): string => {
  let result = content;
  try {
    result = prettier.format(content, {
      singleQuote: true,
      printWidth: 120,
      parser: "typescript",
      tabWidth: 4,
    });
  } catch (error) {
    console.log("->prettier error :", error);
  }
  return result;
};

export const baseDataType = ["boolean", "number", "string", "integer"];

export const numberEnum = [
  "int32",
  "int64",
  "float",
  "double",
  "integer",
  "long",
  "number",
  "int",
];

export const stringEnum = [
  "string",
  "email",
  "password",
  "url",
  "byte",
  "binary",
];

export const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

export const httpMethods: HttpMethods = [
  "get",
  "put",
  "post",
  "delete",
  "patch",
];

export function getResponseRef(apiItem: ApiData) {
  let responses = _.values(_.get(apiItem, "responses", {}));

  let $ref = "";
  while (!$ref && !_.isEmpty(responses)) {
    const head = responses.shift();
    if (!head) {
      break;
    }

    if ("$ref" in head) {
      $ref = head.$ref;
      break;
    }
    //下一轮循环
    if (_.isEmpty(head.content)) {
      continue;
    }
    $ref = _.get(_.values(head.content)[0], "schema.$ref", "");
  }
  return $ref;
}

export function formatterBaseType(
  schemaObject: OpenAPIV3.SchemaObject | undefined
): string {
  if (_.isNil(schemaObject)) {
    return "";
  }
  let type = schemaObject.type;

  if (
    numberEnum.includes(type || "") ||
    numberEnum.includes(schemaObject.format || "")
  ) {
    return "number";
  }

  /*   if (dateEnum.includes(type)) {
    return "Date";
  }*/

  if (stringEnum.includes(type || "")) {
    return "string";
  }

  if (type === "boolean") {
    return "boolean";
  }

  if (
    type === "array" &&
    "items" in schemaObject &&
    "type" in schemaObject.items
  ) {
    return `${formatterBaseType(schemaObject.items)}`;
  }

  //todo
  if (type === "object") {
    errorLog("type ===object");
    return "";
  }

  errorLog("interface type");
  return "";
}

/**
 *query参数为array时,需要转换
 * @param type ts传递类型,js不传
 */
export function getParamsSerializer(type?: string) {
  return `paramsSerializer(params${type ? ":" + type : ""}) {
            return qs.stringify(params)
        }`;
}

/**
 * UploadFormData
 * @param apiItem
 * @param openApi3SourceData
 */
export function generateUploadFormData(
  apiItem: ApiData,
  openApi3SourceData: OpenAPIV3.Document
) {
  const uploadFormDataHeader = `headers: { 'Content-Type': 'multipart/form-data' }`;
  const uploadFormData = `//todo 上传文件
    const formData = new FormData();
    formData.append("file", file);`;

  if (apiItem.requestBody && "$ref" in apiItem.requestBody) {
    const component: OpenAPIV3.RequestBodyObject = _.get(
      openApi3SourceData,
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

/**
 * summary中有下载或者导出 关键字 则增加type
 * @param apiItem
 */
export function downLoadResponseType(apiItem: ApiData) {
  const keys = ["下载", "导出"];
  return _.some(keys, (x) => apiItem.summary?.includes(x))
    ? `responseType:'blob'`
    : "";
}
