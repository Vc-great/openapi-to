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

export const BaseType = ["boolean", "number", "string", "integer"];

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
) {
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
    return `${schemaObject.items.type}[]`;
  }

  //todo
  if (type === "object") {
    errorLog("type ===object");
  }

  errorLog("interface type");
}
