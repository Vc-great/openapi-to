import fsExtra from 'fs-extra'

export function checkFolderHasFiles(folderPath: string) {
  try {
    // 先检查文件夹是否存在
    if (fsExtra.existsSync(folderPath)) {
      const files = fsExtra.readdirSync(folderPath)
      return files.length > 0
    }
    return false
  } catch (error) {
    return false
  }
}
