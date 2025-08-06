//@ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PluginManager, pluginEnum } from '@openapi-to/core'
import { checkFolderHasFiles } from '@openapi-to/core/utils'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import mockOpenAPI from '../mock/petstore.json'
import { definePlugin } from './plugin'

// 导入TsType插件
import { definePlugin as defineTsTypePlugin } from '@openapi-to/plugin-ts-type'
import { definePlugin as defineTsRequestPlugin } from '@openapi-to/plugin-ts-request'

// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_OUTPUT_DIR = path.resolve(__dirname, '../test-output')

describe('Ts Request Plugin Integration', () => {
  beforeEach(() => {
    // 清理并重新创建测试输出目录
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })

    console.log(`测试目录已准备: ${TEST_OUTPUT_DIR}`)
  })

  afterEach(() => {
    // 确保测试目录存在
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
    }
  })

  it('应该生成默认的服务类文件', async () => {
    const pluginManager = new PluginManager(
      {
        name: 'request',
        root: '',
        plugins: [defineTsTypePlugin(), defineTsRequestPlugin(),definePlugin()],
        input: {
          path: '',
        },
        output: {
          dir: TEST_OUTPUT_DIR,
        },
      },
      // @ts-ignore
      mockOpenAPI,
    )

    await pluginManager.run()

    // 检查文件是否生成
    const hasFiles = checkFolderHasFiles(TEST_OUTPUT_DIR)
    expect(hasFiles).toBe(true)

    // 修正为正确的文件路径 - 检查pet目录
    const petDir = path.join(TEST_OUTPUT_DIR, 'pet')
    expect(fs.existsSync(petDir)).toBe(true)

    // 查找pet目录下的所有service文件
    const serviceFiles = fs.readdirSync(petDir).filter((file) => file.endsWith('.service.ts'))
    expect(serviceFiles.length).toBeGreaterThan(0)

    // 选取第一个服务文件进行内容检查
    const petServicePath = path.join(petDir, serviceFiles[0])
    const fileContent = fs.readFileSync(petServicePath, 'utf-8')

    expect(fileContent).toContain('Service')
    expect(fileContent).toMatch(/addPet|updatePet|findPetsByStatus/)

    expect(fileContent).toMatchSnapshot()
  })
})
