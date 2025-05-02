import { getRefAlias } from '@openapi-to/core/utils'
import { nth, split, upperFirst } from 'lodash-es'

export function getUpperFirstRefAlias($ref: string) {
  const alias: Record<string, string> = {
    parameters: 'Parameter',
    requestBodies: 'RequestBodies',
    responses: 'Responses',
  }
  const prefix = nth(split($ref, '/'), 2) || ''

  const prefixAlias = prefix in alias ? alias[prefix] : ''
  return `${prefixAlias}${upperFirst(getRefAlias($ref))}Model`
}
