import { getRefAlias } from '@openapi-to/core/utils'
import { nth, split, upperFirst } from 'lodash-es'

export function getUpperFirstRefAlias($ref: string) {
  const alias: Record<string, string> = {
    parameters: 'Parameter',
    requestBodies: 'RequestBodies',
  }
  const prefix = nth(split($ref, '/'), 2) || ''
  const refAlias = upperFirst(getRefAlias($ref))

  if (prefix === 'responses') {
    return `Response${refAlias}`
  }
  const prefixAlias = prefix in alias ? alias[prefix] : ''
  return `${prefixAlias}${refAlias}Model`
}
