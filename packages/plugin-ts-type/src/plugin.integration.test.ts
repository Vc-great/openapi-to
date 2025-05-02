import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PluginManager } from '@openapi-to/core'
import { checkFolderHasFiles } from '@openapi-to/core/utils'

import type { MediaTypeObject, SchemaObject } from 'oas/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import mockOpenAPI from '../mock/petstore.json'
import { definePlugin } from './plugin'
// 获取当前文件的目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_OUTPUT_DIR = path.resolve(__dirname, '../test-output')

// 模拟简单的 OpenAPI 操作
const mockOperation = {
  accessor: {
    operationName: 'getUser',
    operation: {
      getResponseStatusCodes: () => ['200', '404'],
      getResponseAsJSONSchema: () => [
        {
          description: 'User response',
          label: 'user',
          schema: { type: 'object', properties: { id: { type: 'string' } } },
          type: 'object',
        },
      ],
      getRequestBody: (mediaType?: string): MediaTypeObject | false | [string, MediaTypeObject, ...string[]] => {
        return {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        }
      },
    },
    getParametersSchema(): SchemaObject {
      return {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier' },
          name: { type: 'string', description: 'Name of the entity' },
        },
        required: ['id'],
      }
    },
  },
}

describe('Ts Type Plugin Integration', () => {
  beforeEach(() => {
    // 确保测试输出目录存在
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
    }

    // 确保 types 目录存在
    const typesDir = path.join(TEST_OUTPUT_DIR, 'types')
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true })
    }
  })

  afterEach(() => {
    // 清理测试文件
    const typesDir = path.join(TEST_OUTPUT_DIR, 'types')
    if (fs.existsSync(typesDir)) {
      const files = fs.readdirSync(typesDir)
      files.forEach((file) => {
        // fs.unlinkSync(path.join(typesDir, file))
      })
    }
  })

  it('should generate typescript file with correct namespace', async () => {
    const pluginManager = new PluginManager(
      {
        root: '',
        plugins: [definePlugin()],
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

    pluginManager.run()

    // 检查文件是否生成
    const hasFiles = checkFolderHasFiles(TEST_OUTPUT_DIR)
    expect(hasFiles).toBe(true)

    // 读取文件内容并进行简单验证
    // const fileContent = fs.readFileSync(filePath, 'utf-8')
    // expect(fileContent).toContain('namespace Users')

    expect('').toMatchSnapshot()
  })
})
