import _ from "lodash";

import { formatterType, objectToStringify } from "../utils.ts";

import type { Type } from "@nestjs/common";
import type { ApiPropertyOptions } from "@nestjs/swagger";
import type { Operation } from "oas/operation";
import type { ParameterObject, SchemaObject } from "oas/types";
import type { DecoratorStructure, OptionalKind } from "ts-morph";
import type { Config, ImportStatementsOmitKind } from "../types.ts";

type ApiPropertyOptionsOmitSchemaObjectMetadata = {
  name?: string;
  enum?: any[] | Record<string, any>;
  enumName?: string;
};

type SchemaObjectMetadataOmitSchema = {
  type?: Type<unknown> | Function | [Function] | string | Record<string, any>;
  isArray?: boolean;
  required?: boolean;
};

export class SwaggerGenerator {
  private operation: Operation | undefined;
  private oas: Config["oas"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];

  private parameterObject: ParameterObject | undefined;
  private schemaObject: SchemaObject | undefined;

  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
  }

  get apiPropertyImport(): ImportStatementsOmitKind {
    return {
      namedImports: ["ApiProperty"],
      moduleSpecifier: "@nestjs/swagger",
    };
  }

  generatorDecoratorFromParameterObject(
    parameterObject: ParameterObject,
  ): OptionalKind<DecoratorStructure>[] {
    const schemaObject: SchemaObject =
      parameterObject.schema && "$ref" in parameterObject.schema
        ? this.openapi.findSchemaBy$ref(parameterObject?.schema.$ref)
        : parameterObject?.schema;

    return [
      {
        name: "ApiProperty",
        arguments: [
          this.generateArguments(
            {
              //name: parameterObject.name,
            },
            {
              isArray: schemaObject.type === "array" ? true : undefined,
              required: parameterObject.required,
            },
            {
              schemaObject: schemaObject,
              description: parameterObject.description,
            },
          ),
        ],
      },
    ];
  }

  generatorDecoratorFromSchemaObject({
    schemaObject,
    isRequired,
    name,
  }: {
    schemaObject: SchemaObject;
    isRequired: boolean | undefined;
    name: string | undefined;
  }): OptionalKind<DecoratorStructure>[] {
    this.schemaObject = _.has(schemaObject, "in") ? undefined : schemaObject;
    //const omitSchemaObject = _.omit(schemaObject, ["items", "$ref"]);
    const isArray = schemaObject.type === "array" ? true : undefined;
    const type =
      _.get(schemaObject, "$ref", "") ||
      _.get(schemaObject, "items.$ref", "") ||
      schemaObject.type;
    return [
      {
        name: "ApiProperty",
        arguments: [
          this.generateArguments(
            {
              enum: schemaObject.enum,
              name,
            },
            {
              type:
                _.isString(type) && type.startsWith("#/")
                  ? _.last(type?.split("/"))
                  : formatterType(type as string),
              isArray,
              required: isRequired,
            },
            {
              schemaObject: schemaObject,
              description: schemaObject.description,
            },
          ),
        ],
      },
    ];
  }
  //Partial<ApiPropertyOptions>
  generateArguments(
    apiPropertyOptionsOmitSchemaObjectMetadata: ApiPropertyOptionsOmitSchemaObjectMetadata,
    schemaObjectMetadataOmitSchema: SchemaObjectMetadataOmitSchema,
    {
      schemaObject,
      description,
    }: {
      description: string | undefined;
      schemaObject: SchemaObject;
    },
  ): string {
    const apiPropertyOptions = {
      description,
      ...schemaObject,
      ...schemaObjectMetadataOmitSchema,
      ...apiPropertyOptionsOmitSchemaObjectMetadata,
      items: undefined,
      type: undefined,
    } as ApiPropertyOptions;

    /* const options: ApiPropertyOptions = {
      required: propertyOptions.required || false,
      description: propertyOptions.description,
      examples: propertyOptions.examples,
      example: propertyOptions.example,
      //ApiPropertyOptions
      name: undefined, // string;
      enum: propertyOptions.enum,
      enumName: undefined, // string;
      //SchemaObjectMetadata
      // type: this.setType(),
      isArray: undefined, //boolean;
      // schemaObject
      nullable: undefined, //boolean;
      discriminator: undefined, // DiscriminatorObject;
      readOnly: undefined, // boolean;
      writeOnly: undefined, // boolean;
      xml: undefined, // XmlObject;
      externalDocs: undefined, // ExternalDocumentationObject;
      deprecated: undefined, // boolean;
      allOf: undefined, // (SchemaObject | ReferenceObject)[];
      oneOf: undefined, // (SchemaObject | ReferenceObject)[];
      anyOf: undefined, // (SchemaObject | ReferenceObject)[];
      not: undefined, // SchemaObject | ReferenceObject;
      items: undefined, // SchemaObject | ReferenceObject;
      properties: undefined, // Record<string, SchemaObject | ReferenceObject>;
      additionalProperties: undefined, // SchemaObject | ReferenceObject | boolean;
      patternProperties: undefined, // SchemaObject | ReferenceObject | any;
      format: undefined, // string;
      default: propertyOptions.default, // any;
      title: propertyOptions.title, // string;
      //可以使用multipleOf关键字将数字限制为给定数字的倍数 。它可以设置为任何正数。
      /!**
       * https://json-schema.apifox.cn/
       * {
       *     "type": "number",
       *     "multipleOf" : 10
       * }
       * 0 // OK
       * 10 // OK
       * 20 // OK
       * 23  // not OK，不是 10 的倍数
       *!/
      multipleOf: undefined, // number;
      //数字的范围是使用minimum和maximum关键字的组合指定的
      maximum: undefined, // number;
      minimum: undefined, // number;
      //在 JSON Schema draft4中，exclusiveMinimum和exclusiveMaximum工作方式不同。它们是布尔值，指示是否 minimum和maximum不包括该值
      /!**
       * 如果exclusiveMinimum是false，x ≥ minimum。
       * 如果exclusiveMinimum是true, x > minimum。
       *!/
      exclusiveMinimum: undefined, // boolean;
      exclusiveMaximum: undefined, // boolean;
      maxLength: undefined, // number;
      minLength: undefined, // number;
      pattern: undefined, // string;
      maxItems: undefined, // number;
      minItems: undefined, // number;
      uniqueItems: undefined, // boolean;
      maxProperties: undefined, // number;
      minProperties: undefined, // number;
    };*/

    return objectToStringify(
      _.chain(apiPropertyOptions)
        .reduce(
          (apiPropertyOptions, value, key) => {
            if (_.isNil(value) || key.startsWith("x-")) {
              return apiPropertyOptions;
            }
            apiPropertyOptions[key] = value;
            return apiPropertyOptions;
          },
          {} as { [k: string]: unknown },
        )
        .value() as ApiPropertyOptions,
    );
  }
}
