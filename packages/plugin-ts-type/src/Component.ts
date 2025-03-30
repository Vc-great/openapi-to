import path from "node:path";

import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { StructureKind } from "ts-morph";

import { TYPE_MODEL_FOLDER_NAME, UUID_PREFIX } from "./constants.ts";
import { EnumGenerator } from "./EnumGenerator.ts";
import { Schema } from "./Schema.ts";
import { typeNameAddSuffix } from "./utils.ts";

import type { PluginContext } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type {
  InterfaceDeclarationStructure,
  StatementStructures,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { Config } from "./types.ts";
export class Component {
  private oas: Config["oas"];
  private oldNode: Config["oldNode"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private readonly modelFolderName: string = TYPE_MODEL_FOLDER_NAME;
  private context: PluginContext | null = null;
  private modelIndex: Set<string> = new Set<string>();
  private schema: Schema;
  private enumGenerator: EnumGenerator;
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.schema = new Schema(config);
    this.oldNode = config.oldNode;

    this.enumGenerator = EnumGenerator.getInstance(config);
  }

  build() {}

  /**
   *
   * @param context
   * ```
   * import {Order} from './models'
   * export interface Response {
   * order:Order
   * }
   *
   * ```
   */
  generateCodeByComponent(): void {
    //todo requestBodies
    //this.generateComponentObjectType(this.openapi.component.requestBodyObject);
    _.forEach(this.openapi.component.schemas, (schema, key) => {
      if (this.openapi.isReference(schema)) {
        this.generateCodeByComponentRef(schema, key);
        return;
      }

      this.generateCodeByComponentSchema(schema, key);
    });
  }

  generateCodeByComponentRef(
    schema: OpenAPIV3.ReferenceObject,
    typeName: string,
  ): void {
    const upperFirstTypeName = _.upperFirst(typeName);
    const upperFirstRefName = _.upperFirst(
      this.openapi.getRefAlias(schema.$ref),
    );
    const UUID = `${UUID_PREFIX + upperFirstTypeName}-${upperFirstRefName}`;
    const typeDeclaration = this.oldNode.typeDeclarationCache.get(UUID);
    const statements = [
      ...this.ast.generateImportStatements([
        {
          namedImports: [
            typeDeclaration?.getType()?.getText() ?? upperFirstRefName,
          ],
          isTypeOnly: true,
          moduleSpecifier: `/${TYPE_MODEL_FOLDER_NAME}/index`,
        },
      ]),
      this.ast.generateTypeAliasStatements({
        name: typeDeclaration?.getName() ?? upperFirstTypeName,
        type: typeDeclaration?.getType()?.getText() ?? upperFirstRefName,
        docs: [
          {
            tags: [
              ...(this.pluginConfig?.compare
                ? [
                    {
                      leadingTrivia: "\n",
                      tagName: UUID_TAG_NAME,
                      text: UUID,
                    },
                  ]
                : []),
            ],
          },
        ],
        isExported: true,
      }),
    ];

    this.createModelSourceFile(statements, upperFirstTypeName);
    this.setModelIndexStatements(statements);
  }

  createModelSourceFile(
    statements: Array<StatementStructures>,
    fileName: string,
  ): void {
    const filePath = path.resolve(
      this.openapiToSingleConfig.output.dir || "./",
      `${this.modelFolderName}/${fileName}.ts`,
    );

    this.ast.createSourceFile(filePath, {
      //...(this.generateModelImport() || [])
      ...this.enumGenerator.generateEnum(),
      statements,
    });
  }

  setModelIndexStatements(statements: Array<StatementStructures>): void {
    const whiteKind = [StructureKind.TypeAlias, StructureKind.Interface];

    const names = _.chain(statements)
      .filter((item) => whiteKind.includes(item.kind))
      .map(
        (item: TypeAliasDeclarationStructure | InterfaceDeclarationStructure) =>
          item.name,
      )
      .value() as unknown as string[];

    _.forEach(names, (name) => this.modelIndex.add(name));
  }

  generateModelIndex(): void {
    const statements = _.chain([...this.modelIndex])
      .map((name) =>
        this.ast.generateExportStatements({
          moduleSpecifier: `./${name}`,
        }),
      )
      .value();

    this.createModelSourceFile(statements, "index");
    this.setModelIndexStatements(statements);
  }

  /**
   * schema type
   * @param schema
   * @param key
   */
  generateCodeByComponentSchema(schema: SchemaObject, key: string): void {
    this.openapi.resetRefCache();

    const upperFirstTypeName = _.upperFirst(key);
    const UUID = UUID_PREFIX + upperFirstTypeName;
    const interfaceDeclaration =
      this.oldNode.interfaceDeclarationCache.get(UUID);

    const schemaStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: interfaceDeclaration?.getName() ?? upperFirstTypeName,
      properties: this.schema.getBaseTypeFromSchema(schema, key) || [],
      docs: [
        {
          // description: "\n",
          tags: [
            {
              tagName: "description",
              text: schema.description || "",
            },
            ...(this.pluginConfig?.compare
              ? [
                  {
                    leadingTrivia: schema.description ? "" : "\n",
                    tagName: UUID_TAG_NAME,
                    text: UUID,
                  },
                ]
              : []),
          ].filter((x) => x.text),
        },
      ].filter((x) => x.tags.some((y) => y.text)),
    });

    const importStatements = _.chain([...this.openapi.refCache.keys()])
      .map((ref) => {
        const UUID = UUID_PREFIX + _.upperFirst(this.openapi.getRefAlias(ref));
        const declaration = this.oldNode.declarationCache.get(UUID);
        const name =
          declaration?.getName() ?? _.upperFirst(this.openapi.getRefAlias(ref));
        return this.ast.generateImportStatements([
          ...(name === typeNameAddSuffix(key)
            ? []
            : [
                {
                  namedImports: [name],
                  isTypeOnly: true,
                  moduleSpecifier: `./${name}`,
                },
              ]),
        ]);
      })
      .flatten()
      .value();

    const statements = [
      ...importStatements,
      ...this.enumGenerator.generateEnum(),
      schemaStatements,
    ];

    this.createModelSourceFile(statements, _.upperFirst(key));
    this.setModelIndexStatements(statements);
  }

  /*  generateComponentObjectType(
    componentObject: ComponentObject | null | undefined,
  ): void {
    if (!componentObject) {
      return;
    }

    const name = _.chain(Object.keys(componentObject))
      .head()
      .camelCase()
      .upperFirst()
      .value();
    const typeName = _.upperFirst(_.camelCase(name));
    const value:
      | OpenAPIV3.ReferenceObject
      | MediaTypeObject
      | undefined = _.head(Object.values(componentObject));

    if (!name || !value) {
      return;
    }

    if (this.openapi.isReference(value)) {
      this.generateComponentRefType(value, typeName);
      return;
    }

    let schema: SchemaObject | null = null;

    if ("schema" in value) {
      schema = value.schema || (null as SchemaObject | null);
    }

    if (schema === null) {
      return;
    }
    if (this.openapi.isReference(schema)) {
      this.generateComponentRefType(schema, typeName);
      return;
    }

    if (schema.type === "array") {
      this.createModelSourceFile(
        [
          this.ast.generateTypeAliasStatements({
            name: _.upperFirst(_.camelCase(typeName)),
            type: this.formatterSchemaType(schema),
            //todo
            docs: [{ description: "" }],
            isExported: true,
          }),
        ],
        name,
      );
      return;
    }

    this.generateComponentSchemaType(schema, typeName);
  }*/
}
