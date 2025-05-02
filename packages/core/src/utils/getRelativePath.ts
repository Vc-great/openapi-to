import path from 'node:path'

/**
 * 计算文件的相对路径
 * @param fromFilePath
 * @param toFilePath
 */
export function getRelativePath(fromFilePath: string, toFilePath: string) {
  // 如果文件在同一目录
  if (path.dirname(fromFilePath) === path.dirname(toFilePath)) {
    return `./${path.basename(toFilePath)}`
  }
  // 如果不在同一目录，计算相对路径
  let relativePath = path.relative(path.dirname(fromFilePath), toFilePath)
  // 确保路径以 './' 开头
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`
  }
  return relativePath
}
