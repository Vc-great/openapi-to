import _ from 'lodash'

import { TYPE_MODEL_SUFFIX, TYPE_SUFFIX } from './constants.ts'

export function formatRefName(ref: string): string {
  return _.upperFirst(ref) + _.upperFirst(TYPE_MODEL_SUFFIX)
}

//todo
export function typeNameAddSuffix(typeName: string): string {
  return _.upperFirst(typeName)
}

export function fileAddSuffix(fileName: string): string {
  return `${_.upperFirst(fileName)}.${TYPE_SUFFIX}`
}
