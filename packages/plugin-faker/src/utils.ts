import _ from "lodash";

import { FAKER_SUFFIX } from "./constants.ts";

export function refAddSuffix(ref: string): string {
  return ref + _.upperFirst(FAKER_SUFFIX);
}

//todo
export function fakerNameAddSuffix(fakerName: string): string {
  return fakerName + _.upperFirst(FAKER_SUFFIX);
}

export function fileAddSuffix(fileName: string): string {
  return `${fileName}.${FAKER_SUFFIX}`;
}

export function classNameAddSuffix(className: string): string {
  return _.upperFirst(className) + _.upperFirst(FAKER_SUFFIX);
}
