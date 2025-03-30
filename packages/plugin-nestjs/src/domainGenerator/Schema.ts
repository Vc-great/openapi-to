import path from "node:path";

import _ from "lodash";
import { VariableDeclarationKind } from "ts-morph";

import { NestjsGenerator } from "../NestjsGenerator.ts";
import { formatterType } from "../utils.ts";
import { useEnumCache } from "./EnumCache.ts";
import { SwaggerGenerator } from "./SwaggerGenerator.ts";

import type { PluginContext } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { DecoratorStructure } from "ts-morph";
import type { OptionalKind, PropertyDeclarationStructure } from "ts-morph";
import type { Config } from "../types.ts";
import type { EnumCache } from "./EnumCache.ts";

type OptionalKindOfPropertySignatureStructure = {
  propertiesStructure: Array<OptionalKind<PropertyDeclarationStructure>>;
  validatorDecorator: OptionalKind<DecoratorStructure>[];
  namedImports: Array<string>;
};

export class Schema extends NestjsGenerator {
  private readonly modelFolderName: string = "";
  private context: PluginContext | null = null;

  private swaggerGenerator: SwaggerGenerator;

  private enumCache: EnumCache = useEnumCache();
  constructor(config: Config) {
    super(config);

    this.swaggerGenerator = new SwaggerGenerator(config);
  }

  getSchemaType(schemaObject: SchemaObject): unknown {
    if (schemaObject.type !== "array") {
      //todo
      return this.openapi.formatterSchemaType(schemaObject.type as string);
    }

    const ref: string = _.get(schemaObject, "items.$ref", "");
    const _schemaObject: SchemaObject | undefined = ref
      ? (this.openapi.findSchemaDefinition(ref) as SchemaObject)
      : (schemaObject?.items as SchemaObject);

    return _.get(_schemaObject, "type", "any");
  }

  getPropertyStructureFromSchemaObject(
    schema: SchemaObject | undefined,
  ): OptionalKindOfPropertySignatureStructure | undefined {
    const version = this.oas.getVersion();

    if (!schema) {
      return undefined;
    }

    /*    if (this.openapi.isReference(schema)) {
      return this.openapi.getRefAlias(schema);
    }*/

    if (schema.oneOf) {
      return undefined;
    }

    if (schema.anyOf) {
      return undefined;
    }

    if (schema.allOf) {
      return undefined;
    }

    if (schema.enum) {
      return undefined;
    }

    if ("items" in schema) {
      // items -> array
      return undefined;
    }

    /**
     * OpenAPI 3.1
     * @link https://json-schema.org/understanding-json-schema/reference/array.html#tuple-validation
     */

    if ("prefixItems" in schema) {
      return undefined;
    }

    if (schema.properties || schema.additionalProperties) {
      const properties = this.getDomainFromProperties(schema);

      return properties;
      //  return this.getDomainFromProperties(schema);
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
    if (version === "3.1" && "const" in schema) {
      // const keyword takes precendence over the actual type.
    }

    if (schema.type) {
      if (Array.isArray(schema.type)) {
        // TODO  remove hardcoded first type, second nullable
        // OPENAPI v3.1.0: https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0
        const [type, nullable] =
          schema.type as Array<OpenAPIV3_1.NonArraySchemaObjectType>;

        return undefined;
      }

      //       this.options.dateType === "date" &&
      if (["date", "date-time"].some((item) => item === schema.format)) {
        return undefined;
      }

      // string, boolean, null, number
      //  factory.keywordTypeNodes
      if (schema.type in {}) {
        return undefined;
      }
    }

    if (schema.format === "binary") {
      //Blob
      return undefined;
    }

    return undefined;
  }

  getDomainFromProperties(
    baseSchema?: SchemaObject,
  ): OptionalKindOfPropertySignatureStructure | undefined {
    const properties = baseSchema?.properties || {};
    const required = baseSchema?.required;
    const additionalProperties = baseSchema?.additionalProperties;
    //todo additionalProperties
    if (additionalProperties) {
      return undefined;
    }

    const propertiesStructure = _.chain(properties)
      .keys()
      .map((name) => {
        const schemaObject = properties[name] as SchemaObject;

        const isRequired = _.chain([] as Array<string>)
          .push(_.isBoolean(required) ? name : "")
          .concat(_.isArray(required) ? required : "")
          .filter(Boolean)
          .includes(name)
          .value();

        //
        if (schemaObject.enum && this.enumCache.enumUnique(schemaObject.enum)) {
          this.enumCache.set(schemaObject, this.enumCache.getName(name));
        }

        const refName =
          _.last(_.get(schemaObject, "$ref", "").split("/")) ||
          _.last(_.get(schemaObject, "items.$ref", "").split("/"));

        const type =
          schemaObject.type === "array"
            ? `${_.get(schemaObject, "items.type")}[]`
            : formatterType(schemaObject.type as string);

        const validatorDecorator = this.validatorDecorator.generatorDecorator(
          schemaObject,
          isRequired,
        );

        return {
          validatorDecorator: validatorDecorator,
          namedImports: refName ?? undefined,
          property: {
            leadingTrivia: "\n",
            name: name,
            type: refName || type,
            hasQuestionToken: !isRequired,
            initializer: JSON.stringify(schemaObject.default),
            decorators: [
              ...(validatorDecorator ?? []),
              ...this.swaggerGenerator.generatorDecoratorFromSchemaObject({
                schemaObject: schemaObject,
                isRequired,
                name,
              }),
            ],
          },
        };
      })
      .value();

    return {
      propertiesStructure: propertiesStructure.map((item) => item.property),
      validatorDecorator: _.chain(propertiesStructure)
        .map((item) => item.validatorDecorator)
        .filter((item) => item !== undefined)
        .flatten()
        .value() as OptionalKind<DecoratorStructure>[],
      namedImports: propertiesStructure
        .map((item) => item.namedImports)
        .filter(Boolean),
    };
  }

  formatterSchemaType(schema: SchemaObject | undefined): string {
    const numberEnum = [
      "int32",
      "int64",
      "float",
      "double",
      "integer",
      "long",
      "number",
      "int",
    ];

    const stringEnum = ["string", "email", "password", "url", "byte", "binary"];
    // const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

    if (_.isUndefined(schema)) {
      return "unknown";
    }

    const type = schema.type;
    if (typeof type !== "string") {
      return "unknown";
    }

    if (numberEnum.includes(type) || numberEnum.includes(schema.format || "")) {
      return "number";
    }

    /*   if (dateEnum.includes(type)) {
      return "Date";
    }*/

    if (stringEnum.includes(type || "")) {
      return "string";
    }

    if (type === "boolean") {
      return "boolean";
    }

    if (type === "array" && this.openapi.isReference(schema.items)) {
      return (
        `${_.upperFirst(
          this.openapi.getRefAlias(_.get(schema, "items.$ref", "")),
        )}[]`
      );
    }

    if (type === "array" && !this.openapi.isReference(schema.items)) {
      const arrayType = this.formatterSchemaType(schema.items as SchemaObject);
      return `Array<${arrayType}>`;
    }

    //todo 嵌套object
    if (type === "object" && schema.properties) {
      //return this.getTypeStringFromProperties(schema as ObjectSchema);
    }

    return "unknown";
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
   * export const enum TaskStatusLabel {
   *     WAIT_START:'WAIT_START',
   *     PROCESSING = 'PROCESSING',
   *     FINISHED = 'FINISHED',
   * }
   *
   * export const taskStatusOption = [
   *     { label: TaskStatusLabel.WAIT_START, value: TaskStatus.WAIT_START },
   *     { label: TaskStatusLabel.PROCESSING, value: TaskStatus.PROCESSING },
   *     { label: TaskStatusLabel.FINISHED, value: TaskStatus.FINISHED },
   * ];
   * ```
   */
  generateEnum(): void {
    //
    const labelStatements = _.chain(this.enumCache.entries())
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: `${_.upperFirst(_.camelCase(name))}Label`,
              initializer: this.ast.generateObject(
                ((schema.enum || []) as Array<string>).reduce(
                  (obj, item: string) => {
                    const key: string = _.upperFirst(_.camelCase(item));
                    obj[key] = "''";
                    return obj;
                  },
                  {} as { [key: string]: string },
                ),
              ),
            },
          ],
          docs: [{ description: schema.description || "" }],
        });
      })
      .value();

    //enum
    const valueStatements = _.chain(this.enumCache.entries())
      .map(([schema, name]) => {
        return this.ast.generateEnumStatement({
          isConst: true,
          name: _.upperFirst(_.camelCase(name)),
          members: (schema.enum || []).map((item: string) => {
            return {
              name: _.upperFirst(_.camelCase(item)),
              value: item,
            };
          }),
          docs: [
            {
              description: schema.description,
            },
          ],
        });
      })
      .value();

    // option
    const optionStatements = _.chain(this.enumCache.entries())
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: `${name}Option`,
              initializer:
                `[${(schema.enum || []).reduce((arr, item: string) => {
                  const obj = this.ast.generateObject({
                    label:
                      `${_.upperFirst(_.camelCase(name))}Label.${_.upperFirst(_.camelCase(item))}`,
                    value:
                      `${_.upperFirst(_.camelCase(name))}.${_.upperFirst(_.camelCase(item))}`,
                  });
                  return arr + (arr ? "," : "") + obj;
                }, "")}]`,
            },
          ],
          docs: [{ description: schema.description || "" }],
        });
      })
      .value();

    const enumPath = path.resolve(
      this.openapiToSingleConfig.output.dir || "",
      this.modelFolderName,
      "enum" + ".ts",
    );

    this.ast.createSourceFile(enumPath, {
      statements: [...labelStatements, ...valueStatements, ...optionStatements],
    });
  }
}
