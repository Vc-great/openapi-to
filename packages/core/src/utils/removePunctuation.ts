/**
 * 替换标点符号
 * @param str
 */
export function removePunctuation(str: string): string {
  // \p{P} 匹配所有标点符号, \p{S} 匹配符号
  return str.replace(/[\p{P}\p{S}]/gu, "");
}
