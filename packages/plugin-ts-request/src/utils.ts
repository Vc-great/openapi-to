import { TYPE_NAME_SPACE_SUFFIX } from '@openapi-to/plugin-ts-type/src/constants.ts'
import { ZOD_NAME_SPACE_SUFFIX } from '@openapi-to/plugin-zod/src/constants.ts'
import _ from 'lodash'
import { REQUEST_SUFFIX } from './constants.ts'

export function formatRefName(ref: string): string {
  return `${_.lowerFirst(ref)}${_.upperFirst(REQUEST_SUFFIX)}`
}

export function formatModelMethodName(fakerName: string): string {
  return `${_.lowerFirst(fakerName)}${_.upperFirst(REQUEST_SUFFIX)}`
}

export function formatFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${REQUEST_SUFFIX}`
}

export function formatTypeFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${TYPE_NAME_SPACE_SUFFIX}`
}

export function formatZodFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${ZOD_NAME_SPACE_SUFFIX}`
}

export function formatZodSchemasName(fileName: string): string {
  return `${_.lowerFirst(fileName)}${_.upperFirst(ZOD_NAME_SPACE_SUFFIX)}`
}

export function formatClassName(className: string): string {
  return `${_.upperFirst(className)}${_.upperFirst(REQUEST_SUFFIX)}`
}
