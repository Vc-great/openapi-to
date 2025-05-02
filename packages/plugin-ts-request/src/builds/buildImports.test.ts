//@ts-nocheck
import { StructureKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { RequestClientEnum } from '../types'
import { buildImports } from './buildImports'

describe('buildImports 函数测试', () => {
  it('应该生成基本请求导入语句', () => {
    const imports = [
      {
        kind: StructureKind.ImportDeclaration,
        isTypeOnly: true,
        namedImports: ['Pet'],
        moduleSpecifier: './types',
      },
    ]

    const result = buildImports(imports)

    expect(result).toHaveLength(2) // 1个已有导入 + 默认请求导入
    expect(result).toContainEqual(
      expect.objectContaining({
        kind: StructureKind.ImportDeclaration,
        namedImports: ['request'],
        moduleSpecifier: '@/utils/request',
      }),
    )
    expect(result).toContainEqual(imports[0])
  })

  it('应该生成自定义请求导入模块', () => {
    const imports = []
    const pluginConfig = {
      requestImportDeclaration: {
        moduleSpecifier: '@/services/api',
      },
    }

    const result = buildImports(imports, pluginConfig)

    expect(result).toContainEqual(
      expect.objectContaining({
        kind: StructureKind.ImportDeclaration,
        namedImports: ['request'],
        moduleSpecifier: '@/services/api',
      }),
    )
  })

  it('应该生成包含请求配置类型的导入语句', () => {
    const imports = []
    const pluginConfig = {
      requestConfigTypeImportDeclaration: {
        namedImports: ['CustomRequestConfig'],
        moduleSpecifier: '@/types/request',
      },
    }

    const result = buildImports(imports, pluginConfig)

    expect(result).toContainEqual(
      expect.objectContaining({
        kind: StructureKind.ImportDeclaration,
        isTypeOnly: true,
        namedImports: ['CustomRequestConfig'],
        moduleSpecifier: '@/types/request',
      }),
    )
  })

  it('不应生成axios模块作为请求配置类型导入', () => {
    const imports = []
    const pluginConfig = {
      requestConfigTypeImportDeclaration: {
        namedImports: ['AxiosRequestConfig'],
        moduleSpecifier: 'axios',
      },
    }

    const result = buildImports(imports, pluginConfig)

    expect(result).toHaveLength(1) // 只有基本请求导入
    expect(result).not.toContainEqual(
      expect.objectContaining({
        moduleSpecifier: 'axios',
        isTypeOnly: true,
      }),
    )
  })

  it('应该生成Axios类型导入', () => {
    const imports = []
    const pluginConfig = {
      requestClient: RequestClientEnum.AXIOS,
    }

    const result = buildImports(imports, pluginConfig)

    expect(result).toContainEqual(
      expect.objectContaining({
        kind: StructureKind.ImportDeclaration,
        isTypeOnly: true,
        namedImports: ['AxiosResponse', 'AxiosRequestConfig'],
        moduleSpecifier: 'axios',
      }),
    )
  })

  it('应该合并所有类型的导入语句', () => {
    const imports = [
      {
        kind: StructureKind.ImportDeclaration,
        namedImports: ['Model'],
        moduleSpecifier: './model',
      },
    ]

    const pluginConfig = {
      requestClient: RequestClientEnum.AXIOS,
      requestImportDeclaration: {
        moduleSpecifier: '@/api/request',
      },
      requestConfigTypeImportDeclaration: {
        namedImports: ['CustomConfig'],
        moduleSpecifier: '@/types/config',
      },
    }

    const result = buildImports(imports, pluginConfig)

    expect(result).toHaveLength(4) // 现有导入 + axios类型 + 请求导入 + 自定义配置
    expect(result).toContainEqual(imports[0])
    expect(result).toContainEqual(
      expect.objectContaining({
        moduleSpecifier: 'axios',
      }),
    )
    expect(result).toContainEqual(
      expect.objectContaining({
        moduleSpecifier: '@/api/request',
      }),
    )
    expect(result).toContainEqual(
      expect.objectContaining({
        moduleSpecifier: '@/types/config',
      }),
    )
  })
})
