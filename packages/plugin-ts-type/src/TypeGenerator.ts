import path from "node:path";

import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { VariableDeclarationKind } from "ts-morph";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { UUIDPrefix } from "./utils/UUIDPrefix.ts";
import { Component } from "./Component.ts";
import { useEnumCache } from "./EnumCache.ts";
import { Schema } from "./Schema.ts";

import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type {
  ImportDeclarationStructure,
  InterfaceDeclarationStructure,
  ModuleDeclarationStructure,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { EnumCache } from "./EnumCache.ts";
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
  private enumCache: EnumCache = useEnumCache();
  private importCache: Set<string> = new Set<string>();
  private component: Component;
  private schema: Schema;
  private readonly modelFolderName: string = modelFolderName;
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
  }

  get compare(): boolean {
    return this.pluginConfig?.compare || false;
  }

  get namespaceUUID(): string {
    return UUIDPrefix + this.openapi.currentTagName;
  }
  get nameSpaceName(): string {
    return _.upperFirst(this.openapi.currentTagName);
  }

  get upperFirstNameSpaceName(): string {
    return _.upperFirst(this.openapi.currentTagName);
  }

  build(): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      this.oldNode.setCurrentSourceFile(UUIDPrefix + _.camelCase(tag));

      const typeStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);
          return _.chain([] as Array<TypeStatements | null>)
            .concat(this.generateParametersType())
            .concat(this.generateRequestBodyType())
            .concat(this.generateResponseType())
            .filter(Boolean)
            .value() as Array<TypeStatements>;
        })
        .flatten()
        .filter((x) => !_.isEmpty(x))
        .value();

      const filePath = path.resolve(
        this.openapiToSingleConfig.output.dir,
        this.oldNode.baseName || this.upperFirstNameSpaceName + ".ts",
      );

      const refKey = [...this.openapi.refCache.keys()];

      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(refKey),
          this.generateNameSpace(typeStatements),
        ],
      });

      this.openapi.resetRefCache();
    });
    this.component.generateComponentType();
    this.generateEnum();
    this.component.generateModelIndex();
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
              name: _.upperFirst(_.camelCase(name)) + "Label",
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
          docs:  schema.description?[
            {
              tags: [
                {
                  leadingTrivia: "\n",
                  tagName: "description",
                  text: schema.description,
                },
              ],
            }
          ]:[],
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
          docs:  schema.description?[
            {
              tags: [
                {
                  leadingTrivia: "\n",
                  tagName: "description",
                  text: schema.description,
                },
              ],
            }
          ]:[],
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
              name: name + "Option",
              initializer:
                "[" +
                (schema.enum || []).reduce((arr, item: string) => {
                  const obj = this.ast.generateObject({
                    label:
                      _.upperFirst(_.camelCase(name)) +
                      "Label" +
                      "." +
                      _.upperFirst(_.camelCase(item)),
                    value:
                      _.upperFirst(_.camelCase(name)) +
                      "." +
                      _.upperFirst(_.camelCase(item)),
                  });
                  return arr + (arr ? "," : "") + obj;
                }, "") +
                "]",
            },
          ],
          docs: [{ description: schema.description || "" }].filter(
            (x) => x.description,
          ),
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
        const UUID = UUIDPrefix + name;
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
            {
              tagName: UUID_TAG_NAME,
              text: this.namespaceUUID,
            },
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
    const queryStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "QueryParams",
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
      properties: this.schema.getBaseTypeFromSchema(
        this.openapi.parameter?.getParametersSchema("query") || null,
      )|| [],
    });

    const pathStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "PathParams",
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
      properties: this.schema.getBaseTypeFromSchema(
        this.openapi.parameter?.getParametersSchema("path") || null,
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

  generateResponseType(): Array<
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
        docs: description ? [
          {
            tags: [
              {
                leadingTrivia: "\n",
                tagName: "description",
                text: description,
              },
            ],
          },
        ]: [],
        isExported: true,
      });
    }

    if (schema.type === "object") {
      return this.ast.generateInterfaceStatements({
        isExported: true,
        name,
        docs: description ? [
          {
            tags: [
              {
                leadingTrivia: "\n",
                tagName: "description",
                text: description,
              },
            ],
          },
        ]: [],
        properties: this.schema.getBaseTypeFromSchema(schema) || [],
      });
    }

    return this.ast.generateTypeAliasStatements({
      name,
      type: this.schema.formatterSchemaType(schema),
      docs: description ? [
        {
          tags: [
            {
              leadingTrivia: "\n",
              tagName: "description",
              text: description,
            },
          ],
        },
      ]: [],
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
          type: this.schema.formatterSchemaType(schema) ,
          docs: schema.description ? [
            {
              tags: [
                {
                  leadingTrivia: "\n",
                  tagName: "description",
                  text: schema.description,
                },
              ],
            },
          ]: [],
          isExported: true,
        }),
      ];
    }

    return [
      this.ast.generateInterfaceStatements({
        isExported: true,
        name: this.openapi.upperFirstBodyDataName,
        docs: schema.description ? [
          {
            tags: [
              {
                leadingTrivia: "\n",
                tagName: "description",
                text: schema.description,
              },
            ],
          },
        ] : [],
        properties: this.schema.getBaseTypeFromSchema(schema) || [],
      }),
    ];
  }
}
