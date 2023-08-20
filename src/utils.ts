import prettier from "prettier";
import type { HttpMethods } from "./types";

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
