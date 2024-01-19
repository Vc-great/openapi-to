import pathParser from 'node:path'
import {readSync, write,pathExistsSync} from '@openapi-to/core/utils'
import  presetMeta from './presetMeta.ts'
import pc from 'picocolors'
import { spinner } from './utils/spinner.ts'
import {folderName} from'./utils/folderName.js'


export  async function init(): Promise<undefined> {
  spinner.start('📦 Initializing openapi-to')
  await createConfig()
  await createGitignore()
  spinner.succeed(`📦 initialized openapi-to`)
  return
}


async function createConfig() {
  const path = pathParser.resolve(process.cwd(), `${folderName}/openapi.config.js`)
  spinner.start(`📀 Writing \`openapi.config.js\` ${pc.dim(path)}`)
  await write(presetMeta, path)
  spinner.succeed(`📀 Wrote \`openapi.config.js\` ${pc.dim(path)}`)

}

/**
 * 创建gitignore文件
 */
async function createGitignore() {
  const path = pathParser.resolve(process.cwd(), '.gitignore')
  const content = '# https://github.com/Vc-great/openapi-to\n.OpenAPI'
  spinner.start(`📀 Writing \`.OpenAPI to the .gitignore\` ${pc.dim(path)}`)

  if (pathExistsSync(path)) {
    const fileContent:string = readSync(path)
    const hasOpenAPI = fileContent
      .split("\n")
      .some((item) => item.includes(".OpenAPI") && !item.includes("#"));
    !hasOpenAPI && await write(`${fileContent}\n${content}`, path)
  } else {
    await write(content, path)
  }
  spinner.succeed(`📀 Wrote \`.OpenAPI to the .gitignore\` ${pc.dim(path)}`)
}

