import stringifyObject from "./stringifyObject.ts";

export function formatterType(type: string): string {
  if (type === "integer") {
    return "number";
  }
  return type;
}

export function objectToStringify(object: unknown): string {
  return stringifyObject(object, {
    filter(obj: { [k: string]: unknown }, key: string) {
      return obj[key] !== undefined;
    },
  });
}
