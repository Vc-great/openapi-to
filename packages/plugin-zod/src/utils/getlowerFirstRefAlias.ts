import { getRefAlias } from '@openapi-to/core/utils'
import { lowerFirst, nth, split } from 'lodash-es'

export function getlowerFirstRefAlias($ref: string) {
  const alias: Record<string, string> = {
    parameters: 'parameter',
    requestBodies: 'requestBodies',
    responses: 'responses',
  }
  const prefix = nth(split($ref, '/'), 2) || ''

  const prefixAlias = prefix in alias ? alias[prefix] : ''
  return `${lowerFirst(getRefAlias($ref))}Schema`
}
