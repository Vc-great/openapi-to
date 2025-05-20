import { getRefAlias } from '@openapi-to/core/utils'
import { kebabCase } from 'lodash-es'

export function getRefFilePath(ref: string, dir: string) {
  const str = ref.split('/')[2]
  const fileName = kebabCase(getRefAlias(ref))

  switch (str) {
    case 'parameters':
      return `${dir}/parameters/${fileName}.model.ts`
    case 'requestBodies':
      return `${dir}/requestBodies/${fileName}.model.ts`
    case 'responses':
      return `${dir}/responses/${fileName}.model.ts`
    case 'schemas':
      return `${dir}/models/${fileName}.model.ts`
    default:
      return ''
  }
}
