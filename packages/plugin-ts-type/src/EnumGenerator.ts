import _ from 'lodash'
import { type TypeAliasDeclarationStructure, VariableDeclarationKind } from 'ts-morph'

import type { SchemaObject } from 'oas/types'
import type { EnumDeclarationStructure, VariableStatementStructure } from 'ts-morph'
import { TYPE_MODEL_SUFFIX } from './constants.ts'
import type { Config } from './types.ts'

export class EnumGenerator {
  private enumCache: Map<SchemaObject, string> = new Map<SchemaObject, string>()
  private ast: Config['ast']
  private prefix: string | undefined
  static instance: EnumGenerator
  constructor(config: Config) {
    this.ast = config.ast

    if (EnumGenerator.instance) {
      return EnumGenerator.instance
    }
    EnumGenerator.instance = this
  }

  entries(): Array<[SchemaObject, string]> {
    return [...this.enumCache.entries()]
  }

  set(schema: SchemaObject, name: string): void {
    this.enumCache.set(schema, name)
  }

  enumUnique(enumOfSchema: Array<unknown> | null): boolean {
    const enumOfSchemaString = enumOfSchema?.join() || ''
    return !_.chain([...this.enumCache.keys()])
      .some((schema) => enumOfSchemaString === schema.enum?.join())
      .value()
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix
  }

  resetPrefix(): void {
    this.prefix = undefined
  }

  /**
   * @example
   * ```
   * export const enum TaskStatus {
   *     WAIT_START = 'WAIT_START',
   *     PROCESSING = 'PROCESSING',
   *     FINISHED = 'FINISHED',
   * }
   *
   * export const  TaskStatusLabel ={
   *     WAIT_START:'WAIT_START',
   *     PROCESSING = 'PROCESSING',
   *     FINISHED = 'FINISHED',
   * }
   *
   * export type OrderStatusEnum = (typeof orderStatusEnum)[keyof typeof orderStatusEnum]
   *
   * export const taskStatusOption = [
   *     { label: TaskStatusLabel.WAIT_START, value: TaskStatus.WAIT_START },
   *     { label: TaskStatusLabel.PROCESSING, value: TaskStatus.PROCESSING },
   *     { label: TaskStatusLabel.FINISHED, value: TaskStatus.FINISHED },
   * ];
   * ```
   */
  generateEnum(): Array<VariableStatementStructure | EnumDeclarationStructure | TypeAliasDeclarationStructure> {
    //
    const labelName = (name: string) => `${_.lowerFirst(this.prefix) + (this.prefix ? _.upperFirst(name) : _.lowerFirst(name))}Label`

    const labelStatements = _.chain(this.entries())
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: labelName(name),
              initializer: this.ast.generateObject(
                ((schema.enum || []) as Array<string>).reduce(
                  (obj, item: string) => {
                    const key: string = _.upperFirst(_.camelCase(item))
                    obj[key] = "''"
                    return obj
                  },
                  {} as { [key: string]: string },
                ),
              ),
            },
          ],
          docs: schema.description
            ? [
                {
                  tags: [
                    {
                      leadingTrivia: '\n',
                      tagName: 'description',
                      text: schema.description,
                    },
                  ],
                },
              ]
            : [],
        })
      })
      .value()

    //enum
    const enumConstName = (name: string) => _.lowerFirst(this.prefix) + (this.prefix ? _.upperFirst(name) : _.lowerFirst(name))
    const valueStatements = _.chain(this.entries())
      .map(([schema, name]) => {
        const asConstName = enumConstName(name)

        const asConstEnum = this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: asConstName,
              initializer: `${this.ast.generateObject(
                ((schema.enum || []) as Array<string>).reduce(
                  (obj, item: string) => {
                    const key: string = _.upperFirst(_.camelCase(item))
                    obj[key] = _.isNumber(item) ? item : `'${item}'`
                    return obj
                  },
                  {} as { [key: string]: string },
                ),
              )}as const`,
            },
          ],
          docs: schema.description
            ? [
                {
                  tags: [
                    {
                      leadingTrivia: '\n',
                      tagName: 'description',
                      text: schema.description,
                    },
                  ],
                },
              ]
            : [],
        })

        const enumType = this.ast.generateTypeAliasStatements({
          name: _.upperFirst(asConstName),
          type: `(typeof ${asConstName})[keyof typeof ${asConstName}]`,
          docs: [], //[{ description: "" }],
          isExported: true,
        })
        return [asConstEnum, enumType]
      })
      .flatten()
      .value()

    // option
    const optionStatements = _.chain(this.entries())
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: `${_.lowerFirst(this.prefix) + _.upperFirst(name)}Option`,
              initializer: `[${(schema.enum || []).reduce((arr, item: string) => {
                const obj = this.ast.generateObject({
                  label: `${labelName(name)}.${_.upperFirst(_.camelCase(item))}`,
                  value: `${enumConstName(name)}.${_.upperFirst(_.camelCase(item))}`,
                })
                return arr + (arr ? ',' : '') + obj
              }, '')}]`,
            },
          ],
          docs: [{ description: schema.description || '' }].filter((x) => x.description),
        })
      })
      .value()

    this.enumCache.clear()

    return [...labelStatements, ...valueStatements, ...optionStatements]
  }

  static getInstance(config: Config): EnumGenerator {
    if (!EnumGenerator.instance) {
      EnumGenerator.instance = new EnumGenerator(config)
    }
    return EnumGenerator.instance
  }
}
