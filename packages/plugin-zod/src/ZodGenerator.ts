import path from "node:path";

import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { VariableDeclarationKind } from "ts-morph";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { UUIDPrefix } from "./utils/UUIDPrefix.ts";
import { Component } from "./Component.ts";
import { EnumGenerator } from "./EnumGenerator.ts";
import { Schema } from "./Schema.ts";
import { fileAddSuffix, refAddSuffix, zodNameAddSuffix } from "./utils.ts";
import { Zod } from "./zod.ts";

import type { ObjectStructure } from "@openapi-to/core";
import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type { VariableStatementStructure } from "ts-morph";
import type {
  ImportDeclarationStructure,
  ModuleDeclarationStructure,
} from "ts-morph";
import type { Config } from "./types.ts";
import type { ZodOldNode } from "./ZodOldNode.ts";

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

export class ZodGenerator {
  private operation: Operation | undefined;
  private oas: Config["oas"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];

  private enumGenerator: EnumGenerator;
  private component: Component;
  private schema: Schema;
  private oldNode: ZodOldNode;

  private readonly modelFolderName: string = modelFolderName;
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.component = new Component(config);
    this.schema = new Schema(config);
    this.oldNode = config.oldNode;
    this.enumGenerator = EnumGenerator.getInstance(config);
  }

  get compare(): boolean {
    return this.pluginConfig?.compare || false;
  }

  get namespaceUUID(): string {
    return UUIDPrefix + this.openapi.currentTagName;
  }

  get z(): Zod {
    return new Zod();
  }

  get typeNameSpaceName(): string {
    return _.upperFirst(this.openapi.currentTagNameOfPinYin);
  }

  build(): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      this.oldNode.setCurrentSourceFile(UUIDPrefix + _.camelCase(tag));
      this.enumGenerator.setPrefix(this.typeNameSpaceName);

      const statements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);
          return _.chain([] as Array<any | null>)
            .concat(this.generateParametersType())
            .concat(this.generateRequestBodyType())
            .concat(this.generateCodeByResponse())
            .filter(Boolean)
            .value() as Array<VariableStatementStructure>;
        })
        .flatten()
        .filter((x) => !_.isEmpty(x))
        .value();

      const filePath = path.resolve(
        this.openapiToSingleConfig.output.dir,
        this.oldNode.baseName ||
          `${fileAddSuffix(this.openapi.currentTagNameOfPinYin)}.ts`,
      );

      const refKey = [...this.openapi.refCache.keys()];

      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(refKey),
          ...this.enumGenerator.generateEnum(),
          ...statements,
          this.generateZod(statements),
          this.generateNameSpace(statements),
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
   * import { z } from 'zod';
   * import type { Pet } from './Pet'
   * ```
   */
  generateImport(
    importModel: Array<string>,
  ): Array<ImportDeclarationStructure> {
    const model = _.chain(importModel)
      .map(($ref: string) => refAddSuffix(this.openapi.getRefAlias($ref)))
      .value();

    const typeModel: ImportStatementsOmitKind = {
      namedImports: [...model],
      isTypeOnly: false,
      moduleSpecifier: `./${this.modelFolderName}`,
    };
    const zod: ImportStatementsOmitKind = {
      namedImports: ["z"],
      moduleSpecifier: "zod",
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .push(zod)
      .push(typeModel)
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
    statements: Array<VariableStatementStructure>,
  ): ModuleDeclarationStructure {
    const typeStatements = _.chain(statements)
      .map((item) => {
        const name = _.get(item, "declarations[0].name", "");
        return this.ast.generateTypeAliasStatements({
          name: this.oldNode.TypeNameSpaceName ?? _.upperFirst(name),
          type: this.z.head().infer(name).toString(),
          docs: item.docs,
          isExported: true,
        });
      })
      .value();

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
      name: this.typeNameSpaceName,
      statements: typeStatements,
    });
  }

  generateZod(
    statements: Array<VariableStatementStructure>,
  ): VariableStatementStructure {
    const objectStructure = _.chain(statements)
      .map((item) => {
        return {
          key: _.get(item, "declarations[0].name", ""),
          value: _.get(item, "declarations[0].name", ""),
          docs: item.docs,
        };
      })
      .value() as Array<ObjectStructure>;

    return this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      isExported: true,
      declarations: [
        {
          name:
            this.oldNode.zodNameSpaceName ??
            zodNameAddSuffix(this.openapi.currentTagNameOfPinYin),
          initializer: this.ast.generateObject$2(objectStructure),
        },
      ],
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
    });
  }

  generateParametersType(): Array<VariableStatementStructure> {
    const queryParamsName = `${this.openapi.requestName}QueryParams`;
    const queryParamsSchema =
      this.openapi.parameter?.getParametersSchema("query") || [];
    const queryStatements = this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      isExported: false,
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
      declarations: [
        {
          name: queryParamsName,
          initializer: _.isEmpty(queryParamsSchema)
            ? this.z.head().unknown().optional().toString()
            : this.schema.getZodFromSchema(
                queryParamsSchema,
                this.typeNameSpaceName + _.upperFirst(queryParamsName),
              ),
        },
      ],
    });

    const pathParamsSchema =
      this.openapi.parameter?.getParametersSchema("path") || [];

    const pathParamsName = `${this.openapi.requestName}PathParams`;
    const pathStatements = this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      isExported: true,
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
      declarations: [
        {
          name: pathParamsName,
          initializer: _.isEmpty(pathParamsSchema)
            ? this.z.head().unknown().toString()
            : this.schema.getZodFromSchema(
                pathParamsSchema,
                this.typeNameSpaceName + _.upperFirst(pathParamsName),
              ),
        },
      ],
    });

    return _.chain([] as Array<VariableStatementStructure>)
      .concat(this.openapi.parameter?.hasQueryParameters ? queryStatements : [])
      .concat(this.openapi.parameter?.hasPathParameters ? pathStatements : [])
      .filter(Boolean)
      .value();
  }

  generateCodeByResponse(): Array<VariableStatementStructure> {
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

    const errorEnum = _.chain(errorCode)
      .filter((code) => responseObject.map((x) => x.code).includes(code))
      .map((code) => this.openapi.upperFirstResponseName + code)
      .value();

    const errorType = [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: false,
        docs: [], //[{ description: "" }],
        declarations: [
          {
            name: `${this.openapi.requestName}Error`,
            initializer: _.isEmpty(errorEnum)
              ? this.z.head().unknown().toString()
              : _.size(errorEnum) === 1
                ? _.head(errorEnum)
                : this.z.head().union(errorEnum).toString(),
          },
        ],
      }),
    ];

    const successDefaultType = [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: false,
        docs: [], // [{ description: "" }],
        declarations: [
          {
            name: this.openapi.responseName,
            initializer: this.z.head().unknown().toString(),
          },
        ],
      }),
    ];

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
  }: ResponseObject): VariableStatementStructure {
    const schema = jsonSchema?.schema;
    const description = jsonSchema?.description;
    const isError = /^([3-5][0-9][0-9])$/.test(code);
    const name = this.openapi.responseName + (isError ? code : "");

    if (!schema) {
      return this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: false,
        docs: [], // [{ description: "" }],
        declarations: [
          {
            name,
            initializer: this.z.head().unknown().toString(),
          },
        ],
      });
    }

    if (this.openapi.isReference(schema)) {
      return this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: false,
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
        declarations: [
          {
            name: name,
            initializer: this.z
              .head()
              .lazy(refAddSuffix(this.openapi.getRefAlias(schema.$ref)))
              .toString(),
          },
        ],
      });
    }

    if (schema.type === "array") {
      return this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: false,
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
        declarations: [
          {
            name: name,
            initializer: this.schema.formatterSchemaType(
              schema,
              this.typeNameSpaceName + _.upperFirst(jsonSchema?.label),
            ),
          },
        ],
      });
    }

    return this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      isExported: false,
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
      declarations: [
        {
          name: name,
          initializer: this.schema.getZodFromSchema(schema),
        },
      ],
    });
  }

  //SchemaObject
  generateRequestBodyType(): Array<VariableStatementStructure> | null {
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
        this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: false,
          docs: undefined,
          declarations: [
            {
              name: this.openapi.bodyDataName,
              initializer: this.z
                .head()
                .lazy(refAddSuffix(this.openapi.getRefAlias(schema.$ref)))
                .toString(),
            },
          ],
        }),
      ];
    }

    if (schema.type === "array") {
      return [
        this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: false,
          docs: schema.description
            ? [{ description: schema.description }]
            : undefined,
          declarations: [
            {
              name: this.openapi.bodyDataName,
              initializer: this.schema.formatterSchemaType(
                schema,
                `${this.typeNameSpaceName}BodyData`,
              ),
            },
          ],
        }),
      ];
    }

    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: false,
        docs: schema.description
          ? [{ description: schema.description }]
          : undefined,
        declarations: [
          {
            name: this.openapi.bodyDataName,
            initializer: this.schema.getZodFromSchema(schema),
          },
        ],
      }),
    ];
  }
}
