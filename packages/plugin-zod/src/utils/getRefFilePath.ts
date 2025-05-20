import { getRefAlias } from '@openapi-to/core/utils'
import { kebabCase } from 'lodash-es'

export function getRefFilePath(ref: string, dir: string) {
  const str = ref.split('/')[2]
  const fileName = kebabCase(getRefAlias(ref))

  switch (str) {
    case 'parameters':
      return `${dir}/parameters/${fileName}.schema.ts`
    case 'requestBodies':
      return `${dir}/requestBodies/${fileName}.schema.ts`
    case 'responses':
      return `${dir}/responses/${fileName}.schema.ts`
    case 'schemas':
      return `${dir}/models/${fileName}.schema.ts`
    default:
      return ''
  }
}
