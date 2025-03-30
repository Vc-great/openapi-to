import _ from "lodash";

import { ZOD_SUFFIX } from "./constants.ts";

export function refAddSuffix(ref: string): string {
  return _.lowerFirst(ref) + _.upperFirst(ZOD_SUFFIX);
}

//todo
export function zodNameAddSuffix(zodName: string): string {
  return _.lowerFirst(zodName) + _.upperFirst(ZOD_SUFFIX);
}

export function fileAddSuffix(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${ZOD_SUFFIX}`;
}
