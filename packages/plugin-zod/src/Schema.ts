import _ from "lodash";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { zodSuffix } from "./utils/suffix.ts";
import { UUIDPrefix } from "./utils/UUIDPrefix.ts";
import { EnumGenerator } from "./EnumGenerator.ts";
import { Zod } from "./zod.ts";

import type { ObjectStructure, PluginContext } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { Config } from "./types.ts";
export class Schema {
  private oas: Config["oas"];
  private oldNode: Config["oldNode"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private readonly modelFolderName: string = modelFolderName;
  private context: PluginContext | null = null;

  public fromName: string | undefined;
  private enumGenerator: EnumGenerator;
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.oldNode = config.oldNode;

    this.enumGenerator = EnumGenerator.getInstance(config);
  }

  get z(): Zod {
    return new Zod();
  }

  /**
   *
   * @param schema
   * @example
   * ```
   * //object
   * z.object({})
   * ```
   */
  getZodFromSchema(
    schema: SchemaObject | undefined,
    fromName?: string,
  ): string {
    this.fromName = fromName;
    const version = this.oas.getVersion();

    if (!schema) {
      return "";
    }

    /*    if (this.openapi.isReference(schema)) {
      return this.openapi.getRefAlias(schema);
    }*/

    if (schema.oneOf) {
      return "";
    }

    if (schema.anyOf) {
      return "";
    }

    if (schema.allOf) {
      return "";
    }

    if (schema.enum) {
      return "";
    }

    if ("items" in schema) {
      // items -> array
      return "";
    }

    /**
     * OpenAPI 3.1
     * @link https://json-schema.org/understanding-json-schema/reference/array.html#tuple-validation
     */

    if ("prefixItems" in schema) {
      return "";
    }

    if (schema.properties || schema.additionalProperties) {
      // properties -> literal type
      return this.z.head().object(this.getZodFromProperties(schema)).toString();
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

    return "";
  }

  /**
   *
   * @param baseSchema
   * @example
   * ```
   * {
   *
   * }
   * ```
   *
   */
  getZodFromProperties(baseSchema?: SchemaObject): string {
    if (!baseSchema) {
      return "{}";
    }

    const properties = baseSchema?.properties || {};
    const required = baseSchema?.required;
    const additionalProperties = baseSchema?.additionalProperties;

    const objectStructure: Array<ObjectStructure> = Object.keys(properties).map(
      (name) => {
        const schema = properties[name] as SchemaObject;

        const isRequired = _.chain([] as Array<string>)
          .push(_.isBoolean(required) ? name : "")
          .concat(_.isArray(required) ? required : "")
          .filter(Boolean)
          .includes(name)
          .value();

        //
        if (schema.enum && this.enumGenerator.enumUnique(schema.enum)) {
          const enumName =
            _.upperFirst(this.fromName) + _.upperFirst(name) + "Enum";
          this.enumGenerator.set(schema, enumName);
        }

        const UUID =
          UUIDPrefix +
          (this.openapi.isReference(schema)
            ? _.upperFirst(this.openapi.getRefAlias(schema.$ref))
            : "");
        const variableDeclaration =
          this.oldNode.variableDeclarationCache.get(UUID);

        return {
          key: name,
          value: this.openapi.isReference(schema)
            ? this.z
                .head()
                .lazy(
                  variableDeclaration?.getName() ??
                    this.openapi.getRefAlias(schema.$ref) +
                      _.upperFirst(zodSuffix),
                )
                .optional(isRequired)
                .toString()
            : this.formatterSchemaType(schema, name) +
              this.z.optional(isRequired).toString(),
          docs: _.get(schema, "description")
            ? [
                {
                  tags: [
                    {
                      tagName: "description",
                      text: _.get(schema, "description"),
                    },
                  ],
                },
              ]
            : [],
        };
      },
    );

    //todo additionalProperties
    if (additionalProperties) {
      return "{}";
    }

    return this.ast.generateObject$2(objectStructure);
  }

  formatterSchemaType(
    schema: SchemaObject | undefined,
    propertyName: string,
  ): string {
    if (!_.isEmpty(schema?.enum)) {
      const enumName =
        _.upperFirst(this.fromName) + _.upperFirst(propertyName) + "Enum";

      if (schema?.enum && this.enumGenerator.enumUnique(schema.enum)) {
        this.enumGenerator.set(schema, enumName);
      }
      return enumName;
    }
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
      return this.z.head().unknown().toString();
    }

    const type = schema.type;
    if (typeof type !== "string") {
      return this.z.head().unknown().toString();
    }

    if (numberEnum.includes(type) || numberEnum.includes(schema.format || "")) {
      return this.z.head().number().toString();
    }

    /*   if (dateEnum.includes(type)) {
      return "Date";
    }*/

    if (stringEnum.includes(type || "")) {
      return this.z.head().string().toString();
    }

    if (type === "boolean") {
      return this.z.head().boolean().toString();
    }

    if (type === "array" && this.openapi.isReference(schema.items)) {
      return this.z
        .head()
        .lazy(
          new Zod()
            .array(
              this.openapi.getRefAlias(schema.items.$ref) +
                _.upperFirst(zodSuffix),
            )
            .toString(),
        )
        .toString();
    }

    if (
      type === "array" &&
      !this.openapi.isReference(schema.items) &&
      !_.isBoolean(schema.items) &&
      schema.items &&
      "enum" in schema.items
    ) {
      const arrayType = this.formatterSchemaType(
        schema.items as SchemaObject,
        propertyName,
      );
      return this.z.head().nativeEnum(arrayType).toString();
    }

    if (
      type === "array" &&
      !this.openapi.isReference(schema.items) &&
      !_.isBoolean(schema.items)
    ) {
      const arrayType = this.formatterSchemaType(
        schema.items as SchemaObject,
        propertyName,
      );
      return this.z.array(arrayType).toString();
    }

    //todo 嵌套object
    if (type === "object" && schema.properties) {
      return this.z
        .head()
        .object(this.getZodFromProperties(schema || []))
        .toString();
    }

    return this.z.head().unknown().toString();
  }
}
