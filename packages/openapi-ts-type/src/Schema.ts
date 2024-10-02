import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { UUIDPrefix } from "./utils/UUIDPrefix.ts";
import { useEnumCache } from "./EnumCache.ts";

import type { PluginContext } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { OptionalKind, PropertySignatureStructure } from "ts-morph";
import type { JSDocTagStructure } from "ts-morph";
import type { EnumCache } from "./EnumCache.ts";
import type { Config } from "./types.ts";

type OptionalKindOfPropertySignatureStructure =
  OptionalKind<PropertySignatureStructure>;
export class Schema {
  private oas: Config["oas"];
  private oldNode: Config["oldNode"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private readonly modelFolderName: string = modelFolderName;
  private context: PluginContext | null = null;

  private enumCache: EnumCache = useEnumCache();
  constructor(cofig: Config) {
    this.oas = cofig.oas;
    this.ast = cofig.ast;
    this.pluginConfig = cofig.pluginConfig;
    this.openapiToSingleConfig = cofig.openapiToSingleConfig;
    this.openapi = cofig.openapi;
    this.oldNode = cofig.oldNode;
  }

  getBaseTypeFromSchema(
    schema: SchemaObject | null,
  ): Array<OptionalKindOfPropertySignatureStructure> | undefined {
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
      // properties -> literal type
      return this.getTypeStringFromProperties(schema);
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

    return undefined;
  }

  getTypeStringFromProperties(
    baseSchema?: SchemaObject,
  ): Array<OptionalKindOfPropertySignatureStructure> | undefined {
    const properties = baseSchema?.properties || {};
    const required = baseSchema?.required;
    const additionalProperties = baseSchema?.additionalProperties;

    const typeStatements: Array<OptionalKindOfPropertySignatureStructure> =
      Object.keys(properties).map((name) => {
        const schema = properties[name] as SchemaObject;

        const isRequired = _.chain([] as Array<string>)
          .push(_.isBoolean(required) ? name : "")
          .concat(_.isArray(required) ? required : "")
          .filter(Boolean)
          .includes(name)
          .value();

        //
        if (schema.enum && this.enumCache.enumUnique(schema.enum)) {
          this.enumCache.set(schema, this.enumCache.getName(name));
        }

        const UUID =
          UUIDPrefix +
          (this.openapi.isReference(schema)
            ? _.upperFirst(this.openapi.getRefAlias(schema.$ref))
            : "");
        const interfaceDeclaration =
          this.oldNode.interfaceDeclarationCache.get(UUID);

        return {
          name: _.camelCase(name) + (isRequired ? "" : "?"),
          type: this.openapi.isReference(schema)
            ? (interfaceDeclaration?.getName() ??
              _.upperFirst(this.openapi.getRefAlias(schema.$ref)))
            : this.formatterSchemaType(schema),
          docs: [
            {
              description: "\n",
              tags: _.chain([] as OptionalKind<JSDocTagStructure>[])
                .push({
                  tagName: "description",
                  text: _.get(schema, "description", ""),
                })
                .concat(
                  this.openapi.isReference(schema)
                    ? {
                        tagName: UUID_TAG_NAME,
                        text: UUID,
                      }
                    : [],
                )
                .value(),
            },
          ],
        };
      });

    //todo additionalProperties
    if (additionalProperties) {
      return [
        {
          name: `[key:string]`,
          type: "unknown",
          docs: [{ description: "" }],
        },
      ];
    }

    return typeStatements;
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
      return _.upperFirst(this.openapi.getRefAlias(schema.items.$ref)) + "[]";
    }

    if (type === "array" && !this.openapi.isReference(schema.items)) {
      const arrayType = this.formatterSchemaType(schema.items as SchemaObject);
      return `Array<${arrayType}>`;
    }

    //todo 嵌套object
    if (type === "object" && schema.properties) {
      return this.ast.generateObjectType(
        this.getTypeStringFromProperties(schema) || [],
      );
      //return this.getTypeStringFromProperties(schema as ObjectSchema);
    }

    return "unknown";
  }
}
