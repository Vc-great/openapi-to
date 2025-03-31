import _ from 'lodash'

import { FAKER_SUFFIX } from './constants.ts'

export function formatRefName(ref: string): string {
  return `${_.lowerFirst(ref)}${_.upperFirst(FAKER_SUFFIX)}`
}

export function formatModelMethodName(fakerName: string): string {
  return `${_.lowerFirst(fakerName)}${_.upperFirst(FAKER_SUFFIX)}`
}

export function formatModelFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}-faker.model`
}

export function formatFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}-faker.service`
}

export function formatClassName(className: string): string {
  return `${_.upperFirst(className)}FakerService`
}
