import _ from 'lodash'

import { HANDLER_SUFFIX} from './constants.ts'

export function formatRefName(ref: string): string {
  return `${_.lowerFirst(ref)}${_.upperFirst()}`
}

export function formatModelMethodName(fakerName: string): string {
  return `${_.lowerFirst(fakerName)}${_.upperFirst()}`
}

export function formatFileName(fileName: string): string {
  return `${_.lowerFirst(fileName)}.${_.lowerFirst(HANDLER_SUFFIX)}`
}

export function formatMSWName(className: string): string {
  return `${_.upperFirst(className)}${_.upperFirst(HANDLER_SUFFIX)}`
}
