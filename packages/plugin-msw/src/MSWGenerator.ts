import path from 'node:path'

import { URLPath } from '@openapi-to/core/utils'

import _ from 'lodash'
import { VariableDeclarationKind } from 'ts-morph'

import type { HttpMethod, ObjectStructure, PluginContext } from '@openapi-to/core'
import { formatClassName as formatFakerClassName,formatInstanceName, formatFileName as formatFakerNameSpaceFileName } from '@openapi-to/plugin-faker/utils'
import type { Operation } from 'oas/operation'
import type { ImportDeclarationStructure, VariableStatementStructure } from 'ts-morph'
import type { Config } from './types.ts'
import {formatFileName} from "./utils.ts";
import {HANDLER_SUFFIX} from "./constants.ts";
type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, 'kind'>

export class MSWGenerator {
  private operation: Operation | undefined
  private oas: Config['oas']
  private readonly openapi: Config['openapi']
  private readonly ast: Config['ast']
  private readonly pluginConfig: Config['pluginConfig']
  private readonly openapiToSingleConfig: Config['openapiToSingleConfig']
  private handlerCache: Set<string> = new Set<string>()

  constructor({ oas, openapi, ast, pluginConfig, openapiToSingleConfig }: Config) {
    this.oas = oas
    this.ast = ast
    this.pluginConfig = pluginConfig
    this.openapiToSingleConfig = openapiToSingleConfig
    this.openapi = openapi
  }

  get currentTagName() {
    return this.openapi.currentTagNameOfPinYin
  }
  get handlersName(): string {
    return `${this.currentTagName}Handler`
  }

  get fileName(): string {
    return formatFileName(this.currentTagName)
  }

  get fakerInstanceName(): string {
    return formatInstanceName(this.currentTagName)
  }

  get fakerNameSpaceFileName(): string {
    return formatFakerNameSpaceFileName(this.currentTagName)
  }

  build(context: PluginContext): void {
    _.forEach(_.values(this.openapi.pathGroupByTag), (pathGroup) => {
      const handlerStatements = _.map(pathGroup, ({ path, method, tag }) => {
        this.operation = this.openapi.setCurrentOperation(path, method, tag)
        return this.generatorHandler(path, method)
      })

      const filePath = path.resolve(this.openapiToSingleConfig.output.dir, `${this.fileName}.ts`)
      this.handlerCache.add(this.handlersName)

      this.ast.createSourceFile(filePath, {
        statements: [...this.generateImport(), this.generatorHandlers(handlerStatements), ...this.generatorExport()],
      })
    })

    this.generateHandlers()
  }

  /**
   * @example
   * ```
   * import {petHandlers } from'./petHandlers'
   *
   * export const handlers = [petHandlers]
   * ```
   */
  generateHandlers() {
    const importStatements: Array<ImportDeclarationStructure> = _.chain([...this.handlerCache.keys()])
      .map((handlerName) => {
        const name = handlerName.replace(HANDLER_SUFFIX,'')
        return this.ast.generateImportStatements([
          {
            namedImports: [name],
            moduleSpecifier: `./${formatFileName(name)}`,
          },
        ])
      })
      .push(
        this.ast.generateImportStatements([
          {
            namedImports: ['HttpHandler'],
            moduleSpecifier: 'msw',
          },
        ]),
      )
      .flatten()
      .value()

    const exportStatements = this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'handlers',
          type: 'Array<HttpHandler>',
          initializer: `[${[...this.handlerCache].map((item) => `...${item}`).join(',')}]`,
        },
      ],
      isExported: true,
    })

    const filePath = path.resolve(this.openapiToSingleConfig.output.dir, 'handlers' + '.ts')

    this.ast.createSourceFile(filePath, {
      statements: [...importStatements, exportStatements],
    })
  }

  /**
   * @example
   * ```
   * export const petMSW = handlers
   *                       .filter(x=>x.start)
   *                       .map(x=>x.msw)
   * ```
   */
  generatorExport(): Array<VariableStatementStructure> {
    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: this.handlersName,
            type: 'Array<HttpHandler>',
            initializer: `handlers
                          .filter(x=>x.start)
                          .map(x=>x.msw)`,
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
   * import {HttpResponse,http} from 'msw'
   * import { petFaker } from "./petFaker";
   * ```
   */
  generateImport(): Array<ImportDeclarationStructure> {
    const request: ImportStatementsOmitKind = {
      namedImports: ['HttpResponse', 'http', 'HttpHandler'],
      moduleSpecifier: 'msw',
    }

    const faker: ImportStatementsOmitKind = {
      namedImports: [this.fakerInstanceName],
      moduleSpecifier: `./${this.fakerNameSpaceFileName}`,
    }

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .push(request)
      .push(faker)
      .filter(Boolean)
      .value()

    return this.ast.generateImportStatements(statements)
  }

  /**
   *
   * @example
   * ```
   * {
   *         name:"find",
   *         start:true,
   *         msw:http.get('/pet', (req) => {
   *             return HttpResponse.json([{}])
   *         })
   * }
   * ```
   */
  generatorHandler(path: string, method: HttpMethod): string {
    const objectStructure: Array<ObjectStructure> = [
      {
        key: 'name',
        value: `'${this.openapi.requestName}'`,
      },
      {
        key: 'start',
        value: 'false',
      },
      {
        key: 'msw',
        value: `http.${method}('${new URLPath(path).toURLPath}', (req) => {
                return HttpResponse.json(${this.fakerInstanceName}.${this.openapi.requestName}())
            })`,
      },
    ]
    return this.ast.generateObject$2(objectStructure)
  }

  /**
   *
   * @example
   * ```
   * const handlers = [
   *     {
   *         name:"find",
   *         start:true,
   *         msw:http.get('/pet', (req) => {
   *             return HttpResponse.json([{}])
   *         })
   *     }
   *]
   * ```
   */
  generatorHandlers(objectStructures: Array<string>): VariableStatementStructure {
    return this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      isExported: false,
      docs: [{ description: '' }],
      declarations: [
        {
          name: 'handlers',
          initializer: `[${objectStructures.join(',')}]`,
        },
      ],
    })
  }
}
