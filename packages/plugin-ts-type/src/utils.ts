import _ from "lodash";

import { TYPE_SUFFIX } from "./constants.ts";

export function refAddSuffix(ref: string): string {
  return _.upperFirst(ref) + _.upperFirst(TYPE_SUFFIX);
}

//todo
export function typeNameAddSuffix(typeName: string): string {
  return _.upperFirst(typeName);
}

export function fileAddSuffix(fileName: string): string {
  return `${_.upperFirst(fileName)}.${TYPE_SUFFIX}`;
}
