import path from "node:path";

import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { StructureKind, VariableDeclarationKind } from "ts-morph";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { UUIDPrefix } from "./utils/UUIDPrefix.ts";
import { ZOD_SUFFIX } from "./constants.ts";
import { EnumGenerator } from "./EnumGenerator.ts";
import { Schema } from "./Schema.ts";
import { fileAddSuffix, refAddSuffix, zodNameAddSuffix } from "./utils.ts";
import { Zod } from "./zod.ts";

import type { PluginContext } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { VariableStatementStructure } from "ts-morph";
import type { StatementStructures } from "ts-morph";
import type { Config } from "./types.ts";
export class Component {
  private oas: Config["oas"];
  private oldNode: Config["oldNode"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private readonly modelFolderName: string = modelFolderName;
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

  get z(): Zod {
    return new Zod();
  }

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
    key: string,
  ): void {
    //    const name = key + _.upperFirst(ZOD_SUFFIX);
    const name = zodNameAddSuffix(key);
    const refName = refAddSuffix(this.openapi.getRefAlias(schema.$ref));
    const UUID = UUIDPrefix + name + "-" + refName;
    const variableDeclaration = this.oldNode.variableDeclarationCache.get(UUID);
    const statements = [
      ...this.ast.generateImportStatements([
        {
          namedImports: ["z"],
          isTypeOnly: false,
          moduleSpecifier: `zod`,
        },
        {
          namedImports: [variableDeclaration?.getName() ?? refName],
          isTypeOnly: false,
          moduleSpecifier: `/${this.modelFolderName}/index`,
        },
      ]),
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        isExported: true,
        declarations: [
          {
            name: variableDeclaration?.getName() ?? name,
            initializer: this.z
              .head()
              .lazy(variableDeclaration?.getName() ?? refName)
              .toString(),
          },
        ],
        docs: [],
      }),
    ];
    this.createModelSourceFile(
      statements,
      variableDeclaration?.getName() ?? name,
    );
    //
    this.setModelIndexStatements(statements);
  }

  createModelSourceFile(
    statements: Array<StatementStructures>,
    fileName: string,
  ): void {
    const filePath = path.resolve(
      this.openapiToSingleConfig.output.dir || "./",
      this.modelFolderName + "/" + fileName + ".ts",
    );

    this.ast.createSourceFile(filePath, {
      //...(this.generateModelImport() || [])
      ...this.enumGenerator.generateEnum(),
      statements,
    });
  }

  setModelIndexStatements(statements: Array<StatementStructures>): void {
    const whiteKind = [StructureKind.VariableStatement];

    const names = _.chain(statements)
      .filter((item) => whiteKind.includes(item.kind))
      .map((item: VariableStatementStructure) =>
        _.get(item, "declarations[0].name", ""),
      )
      .value() as unknown as string[];

    _.forEach(names, (name) => this.modelIndex.add(name));
  }

  generateModelIndex(): void {
    const statements = _.chain([...this.modelIndex])
      .map((name) => {
        const fileName = name.endsWith(_.upperFirst(ZOD_SUFFIX))
          ? name.replace(_.upperFirst(ZOD_SUFFIX), "")
          : name;

        return this.ast.generateExportStatements({
          moduleSpecifier: "./" + fileAddSuffix(fileName),
        });
      })
      .value();

    this.createModelSourceFile(statements, "index");
    //
    this.setModelIndexStatements(statements);
  }

  /**
   * schema type
   * @param schema
   * @param key
   */
  generateCodeByComponentSchema(schema: SchemaObject, key: string): void {
    this.openapi.resetRefCache();
    const zodName = zodNameAddSuffix(key);
    const UUID = UUIDPrefix + key;
    const variableDeclaration = this.oldNode.variableDeclarationCache.get(UUID);

    const schemaStatements = this.ast.generateVariableStatements({
      declarationKind: VariableDeclarationKind.Const,
      isExported: true,
      declarations: [
        {
          name: variableDeclaration?.getName() ?? zodName,
          initializer: this.schema.getZodFromSchema(schema, key),
        },
      ],
      docs: [
        {
          //   description: "\n",
          tags: [
            {
              tagName: "description",
              text: schema.description || "",
            },
            ...(this.pluginConfig?.compare
              ? [
                  {
                    tagName: UUID_TAG_NAME,
                    text: UUID,
                  },
                ]
              : []),
          ].filter((x) => x.text),
        },
      ].filter((x) => x.tags.some((y) => y.text)),
    });

    const zodImport = this.ast.generateImportStatements([
      {
        namedImports: ["z"],
        isTypeOnly: false,
        moduleSpecifier: `zod`,
      },
    ]);

    const importStatements = _.chain([...this.openapi.refCache.keys()])
      .map((ref) => {
        const UUID = UUIDPrefix + refAddSuffix(this.openapi.getRefAlias(ref));
        const declaration = this.oldNode.declarationCache.get(UUID);
        const name =
          declaration?.getName() ?? refAddSuffix(this.openapi.getRefAlias(ref));

        return this.ast.generateImportStatements([
          ...(name === zodNameAddSuffix(key)
            ? []
            : [
                {
                  namedImports: [name],
                  isTypeOnly: false,
                  moduleSpecifier:
                    "./" + fileAddSuffix(this.openapi.getRefAlias(ref)),
                },
              ]),
        ]);
      })
      .flatten()
      .value();
    const statements = [
      ...importStatements,
      ...this.enumGenerator.generateEnum(),
      ...zodImport,
      schemaStatements,
    ];
    this.createModelSourceFile(statements, fileAddSuffix(key));
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
