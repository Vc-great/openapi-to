import _ from 'lodash'

import { VUE_QUERY_SUFFIX } from './constants.ts'

export function formatTypeNamespaceName(typeName: string): string {
  return _.upperFirst(typeName) + _.upperFirst(VUE_QUERY_SUFFIX)
}

export function formatQueryName(name: string): string {
  return `${_.lowerFirst(name)}${_.upperFirst(VUE_QUERY_SUFFIX)}`
}

export function formatQueryFileName(name: string): string {
  return `${_.lowerFirst(name)}.${VUE_QUERY_SUFFIX}`
}
