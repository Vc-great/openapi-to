import _ from 'lodash'

import { ZOD_NAME_SPACE_SUFFIX, ZOD_SUFFIX, ZOD_TYPE_MODEL_SUFFIX } from './constants.ts'

export function formatRefName(ref: string): string {
  return _.lowerFirst(ref) + _.upperFirst(ZOD_SUFFIX)
}

export function formatZodNameSpaceName(zodName: string): string {
  return `${_.lowerFirst(zodName) + _.upperFirst(ZOD_NAME_SPACE_SUFFIX)}`
}

export function formatZodName(zodName: string): string {
  return _.lowerFirst(zodName) + _.upperFirst(ZOD_SUFFIX)
}

export function formatZodTypeName(zodName: string): string {
  return _.upperFirst(zodName) + _.upperFirst(ZOD_TYPE_MODEL_SUFFIX)
}

export function formatFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${ZOD_SUFFIX}`
}

export function formatZodNameSpaceFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${ZOD_SUFFIX}s`
}
