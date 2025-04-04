import path from 'node:path'

import { pluginEnum } from '@openapi-to/core'
import { UUID_TAG_NAME } from '@openapi-to/core/utils'
import { TYPE_NAME_SPACE_SUFFIX } from '@openapi-to/plugin-ts-type/src/constants.ts'
import {ZOD_NAME_SPACE_SUFFIX} from '@openapi-to/plugin-zod/src/constants.ts'

import _ from 'lodash'
import { VariableDeclarationKind } from 'ts-morph'

import { Component } from './Component.ts'
import { FakerOldNode } from './FakerOldNode.ts'
import { Schema } from './Schema.ts'
import { MODEL_FOLDER_NAME } from './constants.ts'
import {formatClassName, formatFileName, formatInstanceName, formatRefName} from './utils.ts'

import type { PluginContext } from '@openapi-to/core'
import type { Operation } from 'oas/operation'
import type { SchemaObject } from 'oas/types'
import type { JSDocStructure } from 'ts-morph'
import type { ClassDeclarationStructure } from 'ts-morph'
import type { ImportDeclarationStructure, MethodDeclarationStructure, OptionalKind } from 'ts-morph'
import type { Config } from './types.ts'

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, 'kind'>

type ResponseObject = {
  code: string
  jsonSchema?: {
    description?: string
    label: string
    schema: SchemaObject
    type: string | string[]
  }
}

export class FakerGenerator {
  private operation: Operation | undefined
  private oas: Config['oas']
  private readonly paramsZodSchema: string
  private readonly openapi: Config['openapi']
  private readonly ast: Config['ast']
  private readonly pluginConfig: Config['pluginConfig']
  private readonly openapiToSingleConfig: Config['openapiToSingleConfig']
  private importCache: Set<string> = new Set<string>()
  private schema: Schema
  private component: Component
  oldNode: FakerOldNode
  constructor(config: Config) {
    this.oas = config.oas
    this.ast = config.ast
    this.pluginConfig = config.pluginConfig
    this.openapiToSingleConfig = config.openapiToSingleConfig
    this.openapi = config.openapi
    this.paramsZodSchema = 'paramsZodSchema'

    this.component = new Component(config)
    this.schema = new Schema(config)
    this.oldNode = new FakerOldNode(config.pluginConfig, config.openapiToSingleConfig)
  }
  get compare(): boolean {
    return this.pluginConfig?.compare || false
  }
  get classOperationIdPrefix(): string {
    return 'Faker-'
  }
  get classOperationId(): string {
    return this.classOperationIdPrefix + this.openapi.currentTagName
  }

  get className() {
    return this.oldNode.classDeclaration?.getName() ?? formatClassName(this.openapi.currentTagNameOfPinYin)
  }

  get instanceName() {
    return formatInstanceName(this.openapi.currentTagNameOfPinYin)
  }

  get fileName(): string {
    return this.oldNode.classDeclaration?.getName() ?? formatFileName(this.openapi.currentTagNameOfPinYin)
  }

  get zodFileName(): string {
    return `${this.openapi.currentTagNameOfPinYin}.${ZOD_NAME_SPACE_SUFFIX}`
  }

  //zod or type
  get namespaceTypeName(): string {
    return this.oldNode.typeNamespace.namedImport || _.upperFirst(this.openapi.currentTagNameOfPinYin)
  }

  get upperFirstNamespaceTypeName(): string {
    return this.oldNode.typeNamespace.namedImport || _.upperFirst(this.openapi.currentTagNameOfPinYin)
  }

  get lowerFirstTypeFileName(): string {
    return this.oldNode.typeNamespace.namedImport || `${_.lowerFirst(this.openapi.currentTagNameOfPinYin)}.${TYPE_NAME_SPACE_SUFFIX}`
  }

  get hasZodPlugin() {
    return this.openapiToSingleConfig.pluginNames.includes(pluginEnum.Zod)
  }

  get methodOperationId(): string {
    return this.operation?.getOperationId() || ''
  }

  build(context: PluginContext): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      this.oldNode.setCurrentSourceFile(this.classOperationIdPrefix + _.camelCase(tag))

      const methodsStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag)
          this.oldNode.setCurrentMethod(this.methodOperationId)
          return {
            sort: _.isNumber(this.oldNode.currentMethod?.sort) ? this.oldNode.currentMethod.sort : Number.MAX_SAFE_INTEGER,
            methodsStatements: this.generatorMethod(),
          }
        })
        .sort((a, b) => a.sort - b.sort)
        .map((x) => x.methodsStatements)
        .value()

      const filePath = path.resolve(this.openapiToSingleConfig.output.dir, this.oldNode.baseName || `${this.fileName}.ts`)

      const refKey = [...this.openapi.refCache.keys()]
      const sourceFile = this.ast.createSourceFile(filePath, {
        statements: [...this.generateImport(refKey), this.generatorClass(methodsStatements), ...this.generatorExport()],
      })
      this.openapi.resetRefCache()
      return sourceFile
    })

    this.component.generateComponentType()
    this.component.generateModelIndex()
  }

  /**
   * @example
   * ```
   * const apiName = new ApiName
   * export { apiName }
   * ```
   */
  generatorExport() {
    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: this.instanceName,
            initializer: `new ${this.className}`,
          },
        ],
        isExported: true,
      }),
    ]
  }

  /**
   *
   * @example
   * ```
   * import { faker } from '@faker-js/faker';
   * import type {Pet} from "./Pet";
   * import {list} from './fakerModels'
   * ```
   */
  generateImport(importModel: Array<string>): Array<ImportDeclarationStructure> {
    const model = _.chain(importModel)
      .map(($ref: string) => formatRefName(this.openapi.getRefAlias($ref)))
      .value()
    const fakerModels: ImportStatementsOmitKind = {
      namedImports: [...model],
      moduleSpecifier: `./${MODEL_FOLDER_NAME}`,
    }

    const faker: ImportStatementsOmitKind = {
      namedImports: ['faker'],
      moduleSpecifier: '@faker-js/faker',
    }

    /*
    const typeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.namespaceTypeName],
      moduleSpecifier:
        this.oldNode.typeNamespace.moduleSpecifier ??
        `./${this.namespaceTypeName}`,
    };
*/

    const typeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.upperFirstNamespaceTypeName],
      moduleSpecifier: this.oldNode.typeNamespace.moduleSpecifier ?? `./${this.lowerFirstTypeFileName}`,
    }

    const zodTypeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.upperFirstNamespaceTypeName],
      moduleSpecifier: `./${this.zodFileName}`,
    }

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .concat(faker)
      .concat(fakerModels)
      .concat(this.hasZodPlugin ? [zodTypeModel] : [typeModel])
      .value()

    return this.ast.generateImportStatements(statements)
  }

  generatorClass(methodsStatements: OptionalKind<MethodDeclarationStructure>[]): ClassDeclarationStructure {
    const statements = {
      name: this.className,
      docs: [
        {
          // description: "\n",
          tags: [
            {
              tagName: 'tag',
              text: this.openapi?.currentTagMetadata?.name,
            },
            {
              tagName: 'description',
              text: this.openapi?.currentTagMetadata?.description,
            },
            ...(this.pluginConfig?.compare
              ? [
                  {
                    tagName: UUID_TAG_NAME,
                    text: this.classOperationId,
                  },
                ]
              : []),
          ].filter((x) => x.text),
        },
      ],
      methods: methodsStatements,
    }
    return this.ast.generateClassStatements(statements)
  }

  /**
   * @example
   * ```
   * ApiType.FindByIdResponse
   * ```
   */
  generatorReturnType(): string {
    return `NonNullable<${this.upperFirstNamespaceTypeName}.${this.openapi.upperFirstResponseName}>`
  }

  /**
   * @example
   * ```
   *  @summary 查询事项目录详情
   *  @description 详细描述
   * ```
   */
  generatorMethodDocs(): OptionalKind<JSDocStructure>[] {
    return [
      {
        // description: "\n",
        tags: [
          {
            tagName: 'summary',
            text: this.operation?.getSummary(),
          },
          {
            tagName: 'description',
            text: this.operation?.getDescription(),
          },
          ...(this.pluginConfig?.compare
            ? [
                {
                  tagName: UUID_TAG_NAME,
                  text: this.methodOperationId,
                },
              ]
            : []),
        ].filter((x) => x.text),
      },
    ]
  }

  /**
   * @example
   * ```
   * request({
   *  method:"get",
   *  headers:{
   *    'Content-type':'application/x-www-form-urlencoded'
   *  },
   *  url:"/xxx/xx",
   *  params:query,
   *  data:body,
   * paramsSerializer(params: BusinessType.DetailByIdQueryRequest) {
   *                 return qs.stringify(params)
   *             }
   * })
   * ```
   */
  generatorMethodBody(): string {
    const codes = this.openapi.response?.getResponseStatusCodes || []

    const successCode = (codes || []).filter((code) => /^(2[0-9][0-9]|300)$/.test(code))

    const responseObject = _.chain([...successCode])
      .map((code) => {
        return {
          code,
          jsonSchema: _.head(this.openapi.response?.getResponseAsJSONSchema(code)) || null,
        }
      })
      .filter((x) => !_.isNull(x.jsonSchema))
      .value() as Array<ResponseObject>

    return _.isEmpty(responseObject) ? 'return {}' : this.generateFakerSingleSchema(_.head(responseObject) as ResponseObject)
  }

  generateFakerSingleSchema({ code, jsonSchema }: ResponseObject): string {
    const schema = jsonSchema?.schema
    const description = jsonSchema?.description
    const isError = /^([3-5][0-9][0-9])$/.test(code)
    const name = `${this.openapi.requestName}Response${isError ? code : ''}`

    if (!schema) {
      return 'return {}'
    }

    if (this.openapi.isReference(schema)) {
      return `return ${formatRefName(this.openapi.getRefAlias(schema.$ref))}()`
    }

    if (schema.type === 'array') {
      //todo
      return `return ${this.schema.formatterSchemaType(schema)}`
    }
    //todo
    if ('additionalProperties' in schema) {
      return 'return {}'
    }

    return `return ${this.schema.getStatementsFromSchema(schema)}`
  }

  generatorMethod(): MethodDeclarationStructure {
    const statement = {
      name: this.oldNode.methodName ?? this.openapi.requestName,
      decorators: [],
      parameters: [],
      returnType: this.generatorReturnType(),
      docs: this.generatorMethodDocs(),
      statements: this.generatorMethodBody(),
    }
    return this.ast.generateMethodStatements(statement)
  }
}
