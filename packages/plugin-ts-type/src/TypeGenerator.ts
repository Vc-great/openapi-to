import path from "node:path";

import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";

import { Component } from "./Component.ts";
import {
  TYPE_MODEL_FOLDER_NAME,
  TYPE_SUFFIX,
  UUID_PREFIX,
} from "./constants.ts";
import { EnumGenerator } from "./EnumGenerator.ts";
import { Schema } from "./Schema.ts";

import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type {
  ImportDeclarationStructure,
  InterfaceDeclarationStructure,
  ModuleDeclarationStructure,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { TypeOldNode } from "./TypeOldNode.ts";
import type { Config } from "./types.ts";
type TypeStatements =
  | InterfaceDeclarationStructure
  | TypeAliasDeclarationStructure;

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

type ResponseObject = {
  code: string;
  jsonSchema?: {
    description?: string;
    label: string;
    schema: SchemaObject;
    type: string | string[];
  };
};

export class TypeGenerator {
  private operation: Operation | undefined;
  private oas: Config["oas"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private enumGenerator: EnumGenerator;
  private importCache: Set<string> = new Set<string>();
  private component: Component;
  private schema: Schema;
  private readonly modelFolderName: string = TYPE_MODEL_FOLDER_NAME;
  private oldNode: TypeOldNode;
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;

    this.schema = new Schema(config);
    this.oldNode = config.oldNode;
    this.component = new Component(config);
    this.enumGenerator = EnumGenerator.getInstance(config);
  }

  get compare(): boolean {
    return this.pluginConfig?.compare || false;
  }

  get namespaceUUID(): string {
    return UUID_PREFIX + this.openapi.currentTagNameOfPinYin;
  }
  get nameSpaceName(): string {
    return _.upperFirst(this.openapi.currentTagNameOfPinYin);
  }

  get fileName(): string {
    return (
      this.oldNode.baseName ||
      _.lowerFirst(this.openapi.currentTagNameOfPinYin) + "." + TYPE_SUFFIX
    );
  }

  build(): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      this.oldNode.setCurrentSourceFile(UUID_PREFIX + _.camelCase(tag));
      this.enumGenerator.setPrefix(this.nameSpaceName);
      const typeStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);

          return _.chain([] as Array<TypeStatements | null>)
            .concat(this.generateParametersType())
            .concat(this.generateRequestBodyType())
            .concat(this.generateCodeByResponse())
            .filter(Boolean)
            .value();
        })
        .flatten()
        .filter((x) => !_.isEmpty(x))
        .value();

      const filePath = path.resolve(
        this.openapiToSingleConfig.output.dir,
        this.fileName + ".ts",
      );

      const refKey = [...this.openapi.refCache.keys()];

      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(refKey),
          ...this.enumGenerator.generateEnum(),
          this.generateNameSpace(typeStatements),
        ],
      });

      this.openapi.resetRefCache();
    });

    this.enumGenerator.resetPrefix();
    this.component.generateCodeByComponent();

    this.component.generateModelIndex();
  }

  /**
   *
   * @example
   * ```
   * // ts type
   * import type { DrmsDynamicDataType } from './drmsDynamicDataZod'
   * ```
   */
  generateImport(
    importModel: Array<string>,
  ): Array<ImportDeclarationStructure> {
    const model = _.chain(importModel)
      .map(($ref: string) => {
        const name = _.upperFirst(this.openapi.getRefAlias($ref));
        const UUID = UUID_PREFIX + name;
        const declaration = this.oldNode.declarationCache.get(UUID);
        return declaration?.getName() ?? name;
      })
      .value();

    const typeModel: ImportStatementsOmitKind = {
      namedImports: [...model],
      isTypeOnly: true,
      moduleSpecifier: "./" + this.modelFolderName,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .concat(_.isEmpty(model) ? [] : typeModel)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  /**
   * @example
   * ```
   * export namespace Tag {
   *  export type queryRequest = object
   * }
   * ```
   */
  generateNameSpace(
    typeStatements: Array<TypeStatements>,
  ): ModuleDeclarationStructure {
    return this.ast.generateModuleStatements({
      docs: [
        {
          tags: [
            {
              tagName: "tag",
              text: this.openapi.currentTagName,
            },
            {
              tagName: "description",
              text: this.openapi.currentTagMetadata?.description,
            },
            ...(this.pluginConfig?.compare
              ? [
                  {
                    tagName: UUID_TAG_NAME,
                    text: this.namespaceUUID,
                  },
                ]
              : []),
          ].filter((x) => x.text),
        },
      ],
      isExported: true,
      name: this.oldNode.namespaceName ?? this.nameSpaceName,
      statements: typeStatements,
    });
  }

  generateParametersType(): Array<
    InterfaceDeclarationStructure | TypeAliasDeclarationStructure
  > {
    if (this.openapi.upperFirstRequestName === "FindByStatusGet") {
      //debugger;
    }
    const queryParamsName = this.openapi.upperFirstRequestName + "QueryParams";
    const queryStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: queryParamsName,
      docs: [
        {
          tags: [
            {
              leadingTrivia: "\n",
              tagName: "description",
              text: "queryParams",
            },
          ],
        },
      ],
      properties:
        this.schema.getBaseTypeFromSchema(
          this.openapi.parameter?.getParametersSchema("query") || null,
          this.nameSpaceName + queryParamsName,
        ) || [],
    });
    const pathParamsName = this.openapi.upperFirstRequestName + "PathParams";
    const pathStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: pathParamsName,
      docs: [
        {
          tags: [
            {
              leadingTrivia: "\n",
              tagName: "description",
              text: "pathParams",
            },
          ],
        },
      ],
      properties:
        this.schema.getBaseTypeFromSchema(
          this.openapi.parameter?.getParametersSchema("path") || null,
          this.nameSpaceName + pathParamsName,
        ) || [],
    });
    //[mediaType, bodySchema, description]

    return _.chain(
      [] as Array<
        InterfaceDeclarationStructure | TypeAliasDeclarationStructure
      >,
    )
      .concat(this.openapi.parameter?.hasQueryParameters ? queryStatements : [])
      .concat(this.openapi.parameter?.hasPathParameters ? pathStatements : [])
      .filter(Boolean)
      .value();
  }

  generateCodeByResponse(): Array<
    InterfaceDeclarationStructure | TypeAliasDeclarationStructure
  > {
    const codes = this.openapi.response?.getResponseStatusCodes || [];

    const successCode = (codes || []).filter((code) =>
      /^(2[0-9][0-9]|300)$/.test(code),
    );
    const errorCode = (codes || []).filter((code) =>
      /^([3-5][0-9][0-9])$/.test(code),
    );
    const isSuccessCode = (code: string) => /^(2[0-9][0-9]|300)$/.test(code);

    const responseObject = _.chain([...successCode, ...errorCode])
      .map((code) => {
        return {
          code,
          jsonSchema:
            _.head(this.openapi.response?.getResponseAsJSONSchema(code)) ||
            null,
        };
      })
      .filter((x) => !_.isNull(x.jsonSchema))
      .value() as Array<ResponseObject>;

    const errorType = this.ast.generateTypeAliasStatements({
      name: this.openapi.upperFirstRequestName + "Error",
      type:
        _.chain(errorCode)
          .filter((code) => responseObject.map((x) => x.code).includes(code))
          .map((code) => this.openapi.upperFirstResponseName + code)
          .join("|")
          .value() || "unknown",
      //docs: [{ description: "" }],
      isExported: true,
    });

    const successDefaultType = this.ast.generateTypeAliasStatements({
      name: this.openapi.upperFirstResponseName,
      type: "unknown",
      docs: [], //[{ description: "" }],
      isExported: true,
    });

    return _.chain(responseObject)
      .map((responseObject) =>
        this.generateResponseSingleSchema(responseObject),
      )
      .concat(errorType)
      .concat(_.isEmpty(successCode) ? successDefaultType : [])
      .filter(Boolean)
      .value();
  }

  generateResponseSingleSchema({
    code,
    jsonSchema,
  }: ResponseObject):
    | InterfaceDeclarationStructure
    | TypeAliasDeclarationStructure {
    const schema = jsonSchema?.schema;
    const description = jsonSchema?.description;
    const isError = /^([3-5][0-9][0-9])$/.test(code);
    const name = this.openapi.upperFirstResponseName + (isError ? code : "");

    if (!schema) {
      return this.ast.generateTypeAliasStatements({
        name,
        type: "unknown",
        docs: [], //[{ description: "" }],
        isExported: true,
      });
    }

    if (this.openapi.isReference(schema)) {
      return this.ast.generateTypeAliasStatements({
        name,
        type: _.upperFirst(this.openapi.getRefAlias(schema.$ref)),
        docs: description
          ? [
              {
                tags: [
                  {
                    leadingTrivia: "\n",
                    tagName: "description",
                    text: description,
                  },
                ],
              },
            ]
          : [],
        isExported: true,
      });
    }

    if (schema.type === "object") {
      return this.ast.generateInterfaceStatements({
        isExported: true,
        name,
        docs: description
          ? [
              {
                tags: [
                  {
                    leadingTrivia: "\n",
                    tagName: "description",
                    text: description,
                  },
                ],
              },
            ]
          : [],
        properties: this.schema.getBaseTypeFromSchema(schema) || [],
      });
    }

    return this.ast.generateTypeAliasStatements({
      name,
      type: this.schema.formatterSchemaType(
        schema,
        this.nameSpaceName + _.upperFirst(jsonSchema?.label),
      ),
      docs: description
        ? [
            {
              tags: [
                {
                  leadingTrivia: "\n",
                  tagName: "description",
                  text: description,
                },
              ],
            },
          ]
        : [],
      isExported: true,
    });
  }

  //SchemaObject
  generateRequestBodyType(): Array<TypeStatements> | null {
    const _bodySchema = this.openapi.requestBody?.getRequestBodySchema();
    if (_bodySchema === undefined || _.isBoolean(_bodySchema)) {
      return null;
    }
    let schema: SchemaObject | null = null;
    if ("schema" in _bodySchema) {
      schema = _bodySchema.schema || (null as SchemaObject | null);
    }

    if (_.isArray(_bodySchema)) {
      schema = _.get(_bodySchema, "[1].schema", null) as SchemaObject | null;
    }

    if (schema === null) {
      return null;
    }

    if (this.openapi.isReference(schema)) {
      return [
        this.ast.generateTypeAliasStatements({
          name: this.openapi.upperFirstBodyDataName,
          type: _.upperFirst(this.openapi.getRefAlias(schema.$ref)),
          docs: [], //[{ description: "" }],
          isExported: true,
        }),
      ];
    }

    if (schema.type === "array") {
      return [
        this.ast.generateTypeAliasStatements({
          name: this.openapi.upperFirstBodyDataName,
          type: this.schema.formatterSchemaType(
            schema,
            this.nameSpaceName + "BodyData",
          ),
          docs: schema.description
            ? [
                {
                  tags: [
                    {
                      leadingTrivia: "\n",
                      tagName: "description",
                      text: schema.description,
                    },
                  ],
                },
              ]
            : [],
          isExported: true,
        }),
      ];
    }

    return [
      this.ast.generateInterfaceStatements({
        isExported: true,
        name: this.openapi.upperFirstBodyDataName,
        docs: schema.description
          ? [
              {
                tags: [
                  {
                    leadingTrivia: "\n",
                    tagName: "description",
                    text: schema.description,
                  },
                ],
              },
            ]
          : [],
        properties: this.schema.getBaseTypeFromSchema(schema) || [],
      }),
    ];
  }
}
