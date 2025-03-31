import { UUID_TAG_NAME } from '@openapi-to/core/utils'

import _ from 'lodash'

import { EnumGenerator } from './EnumGenerator.ts'
import { TYPE_MODEL_SUFFIX, UUID_PREFIX } from './constants.ts'

import type { PluginContext } from '@openapi-to/core'
import type { SchemaObject } from 'oas/types'
import type { OptionalKind, PropertySignatureStructure } from 'ts-morph'
import type { JSDocTagStructure } from 'ts-morph'
import type { Config } from './types.ts'
import { formatRefName } from './utils.ts'

type OptionalKindOfPropertySignatureStructure = OptionalKind<PropertySignatureStructure>
export class Schema {
  private oas: Config['oas']
  private oldNode: Config['oldNode']
  private readonly openapi: Config['openapi']
  private readonly ast: Config['ast']
  private readonly pluginConfig: Config['pluginConfig']
  private readonly openapiToSingleConfig: Config['openapiToSingleConfig']
  private context: PluginContext | null = null
  public fromName: string | undefined
  private enumGenerator: EnumGenerator
  constructor(config: Config) {
    this.oas = config.oas
    this.ast = config.ast
    this.pluginConfig = config.pluginConfig
    this.openapiToSingleConfig = config.openapiToSingleConfig
    this.openapi = config.openapi
    this.oldNode = config.oldNode

    this.enumGenerator = EnumGenerator.getInstance(config)
  }

  getBaseTypeFromSchema(schema: SchemaObject | null, fromName?: string): Array<OptionalKindOfPropertySignatureStructure> | undefined {
    this.fromName = fromName
    const version = this.oas.getVersion()

    if (!schema) {
      return undefined
    }

    /*    if (this.openapi.isReference(schema)) {
      return this.openapi.getRefAlias(schema);
    }*/

    if (schema.oneOf) {
      return undefined
    }

    if (schema.anyOf) {
      return undefined
    }

    if (schema.allOf) {
      return undefined
    }

    if (schema.enum) {
      return undefined
    }

    if ('items' in schema) {
      // items -> array
      return undefined
    }

    /**
     * OpenAPI 3.1
     * @link https://json-schema.org/understanding-json-schema/reference/array.html#tuple-validation
     */

    if ('prefixItems' in schema) {
      return undefined
    }

    if (schema.properties || schema.additionalProperties) {
      // properties -> literal type
      return this.getTypeStringFromProperties(schema)
    }

    /**
     * validate "const" property as defined in JSON-Schema-Validation
     *
     * https://json-schema.org/draft/2020-12/json-schema-validation#name-const
     *
     * > 6.1.3. const
     * > The value of this keyword MAY be of any type, including null.
     * > Use of this keyword is functionally equivalent to an "enum" (Section 6.1.2) with a single value.
     * > An instance validates successfully against this keyword if its value is equal to the value of the keyword.
     */
    if (version === '3.1' && 'const' in schema) {
      // const keyword takes precendence over the actual type.
    }

    /*    if (schema.type) {
      if (Array.isArray(schema.type)) {
        // TODO  remove hardcoded first type, second nullable
        // OPENAPI v3.1.0: https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0
        const [type, nullable] =
          schema.type as Array<OpenAPIV3_1.NonArraySchemaObjectType>;

        return factory.createUnionDeclaration({
          nodes: [
            this.getTypeFromSchema(
              {
                ...schema,
                type,
              },
              baseName,
            ),
            nullable
              ? factory.createLiteralTypeNode(factory.createNull())
              : undefined,
          ].filter(Boolean),
        });
      }

      if (
        this.options.dateType === "date" &&
        ["date", "date-time"].some((item) => item === schema.format)
      ) {
        return factory.createTypeReferenceNode(
          factory.createIdentifier("Date"),
        );
      }

      // string, boolean, null, number
      if (schema.type in factory.keywordTypeNodes) {
        return factory.keywordTypeNodes[
          schema.type as keyof typeof factory.keywordTypeNodes
        ];
      }
    }

    if (schema.format === "binary") {
      return factory.createTypeReferenceNode("Blob", []);
    }*/

    return undefined
  }

  getTypeStringFromProperties(baseSchema?: SchemaObject): Array<OptionalKindOfPropertySignatureStructure> | undefined {
    const properties = baseSchema?.properties || {}
    const required = baseSchema?.required
    const additionalProperties = baseSchema?.additionalProperties

    const typeStatements: Array<OptionalKindOfPropertySignatureStructure> = Object.keys(properties).map((name) => {
      const schema = properties[name] as SchemaObject

      const isRequired = _.chain([] as Array<string>)
        .push(_.isBoolean(required) ? name : '')
        .concat(_.isArray(required) ? required : '')
        .filter(Boolean)
        .includes(name)
        .value()

      //
      if (schema.enum && this.enumGenerator.enumUnique(schema.enum)) {
        const enumName = `${_.upperFirst(this.fromName) + _.upperFirst(name)}Enum`
        this.enumGenerator.set(schema, enumName)
      }

      const UUID = UUID_PREFIX + (this.openapi.isReference(schema) ? _.upperFirst(this.openapi.getRefAlias(schema.$ref)) : '')
      const interfaceDeclaration = this.oldNode.interfaceDeclarationCache.get(UUID)

      return {
        name: _.camelCase(name) + (isRequired ? '' : '?'),
        type: this.openapi.isReference(schema)
          ? (interfaceDeclaration?.getName() ?? formatRefName(_.upperFirst(this.openapi.getRefAlias(schema.$ref))))
          : this.formatterSchemaType(schema, name),
        docs: [
          {
            //  description: "\n",
            tags: _.chain([] as OptionalKind<JSDocTagStructure>[])
              .push({
                leadingTrivia: this.openapi.isReference(schema) ? '' : '\n',
                tagName: 'description',
                text: _.get(schema, 'description', ''),
              })
              .concat(
                this.openapi.isReference(schema) && this.pluginConfig?.compare
                  ? {
                      leadingTrivia: _.get(schema, 'description', '') ? '' : '\n',
                      tagName: UUID_TAG_NAME,
                      text: UUID,
                    }
                  : [],
              )
              .filter((x) => Boolean(x.text))
              .value(),
          },
        ].filter((x) => !_.isEmpty(x.tags)),
      }
    })

    //todo additionalProperties
    if (additionalProperties) {
      return [
        {
          name: '[key:string]',
          type: 'unknown',
          // docs: [{ description: "" }],
        },
      ]
    }

    return typeStatements
  }

  formatterSchemaType(schema: SchemaObject | undefined, propertyName: string): string {
    if (!_.isEmpty(schema?.enum)) {
      const enumName = `${_.upperFirst(this.fromName) + _.upperFirst(propertyName)}Enum`

      if (schema?.enum && this.enumGenerator.enumUnique(schema.enum)) {
        this.enumGenerator.set(schema, enumName)
      }
      return enumName
    }

    const numberEnum = ['int32', 'int64', 'float', 'double', 'integer', 'long', 'number', 'int']

    const stringEnum = ['string', 'email', 'password', 'url', 'byte', 'binary']
    // const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

    if (_.isUndefined(schema)) {
      return 'unknown'
    }

    const type = schema.type
    if (typeof type !== 'string') {
      return 'unknown'
    }

    if (numberEnum.includes(type) || numberEnum.includes(schema.format || '')) {
      return 'number'
    }

    /*   if (dateEnum.includes(type)) {
      return "Date";
    }*/

    if (stringEnum.includes(type || '')) {
      return 'string'
    }

    if (type === 'boolean') {
      return 'boolean'
    }

    if (type === 'array' && this.openapi.isReference(schema.items)) {
      return `${_.upperFirst(this.openapi.getRefAlias(schema.items.$ref)) + _.upperFirst(TYPE_MODEL_SUFFIX)}[]`
    }

    if (type === 'array' && !this.openapi.isReference(schema.items)) {
      const arrayType = this.formatterSchemaType(schema.items as SchemaObject, propertyName)
      return `Array<${arrayType}>`
    }

    //todo 嵌套object
    if (type === 'object' && schema.properties) {
      return this.ast.generateObjectType(this.getTypeStringFromProperties(schema) || [])
      //return this.getTypeStringFromProperties(schema as ObjectSchema);
    }

    return 'unknown'
  }
}
