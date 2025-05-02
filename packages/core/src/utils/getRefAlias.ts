import isChinese from 'is-chinese'
import { camelCase } from 'lodash-es'
import { pinyin } from 'pinyin-pro'
import { removePunctuation } from './removePunctuation.ts'

export function getRefAlias($ref: string): string {
  const typeName = $ref.replace(/.+\//, '')
  return isChinese(typeName)
    ? pinyin(removePunctuation(typeName), {
        toneType: 'none',
        type: 'array',
      }).join('_')
    : camelCase(typeName)
}
