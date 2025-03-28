import path from "node:path";

import { pluginEnum } from "@openapi-to/core";
import { TYPE_MODEL_FOLDER_NAME } from "@openapi-to/core/utils";
import { ZOD_MODEL_FOLDER_NAME } from "@openapi-to/plugin-zod/src/constants.ts";

import _ from "lodash";
import { StructureKind } from "ts-morph";

import { FAKER_SUFFIX, MODEL_FOLDER_NAME } from "./constants.ts";
import { Faker } from "./Faker";
import { Schema } from "./Schema.ts";
import { fakerNameAddSuffix, fileAddSuffix, refAddSuffix } from "./utils.ts";

import type { PluginContext } from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { ImportDeclarationStructure } from "ts-morph";
import type { StatementStructures } from "ts-morph";
import type { Config } from "./types.ts";

export class Component {
  private oas: Config["oas"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private context: PluginContext | null = null;
  private modelIndex: Set<string> = new Set<string>();
  private schema: Schema;

  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.schema = new Schema(config);
  }

  get faker(): Faker {
    return new Faker();
  }

  get hasZodPlugin() {
    return this.openapiToSingleConfig.pluginNames.includes(pluginEnum.Zod);
  }

  build() {}

  generateComponentType(): void {
    //todo requestBodies
    //this.generateComponentObjectType(this.openapi.component.requestBodyObject);
    _.forEach(this.openapi.component.schemas, (schema, key) => {
      if (this.openapi.isReference(schema)) {
        this.generateCodeComponentRef(schema, key);
        return;
      }

      this.generateCodeForComponentSchema(schema, key);
    });
  }

  generateCodeComponentRef(
    schema: OpenAPIV3.ReferenceObject,
    key: string,
  ): void {
    const name = fakerNameAddSuffix(key);
    this.createModelSourceFile(
      [
        ...this.ast.generateImportStatements([
          {
            namedImports: ["faker"],
            isTypeOnly: false,
            moduleSpecifier: `@faker-js/faker`,
          },
          {
            namedImports: [refAddSuffix(this.openapi.getRefAlias(schema.$ref))],
            isTypeOnly: false,
            moduleSpecifier: `/${MODEL_FOLDER_NAME}/index`,
          },
          {
            namedImports: [_.upperFirst(_.camelCase(name))],
            isTypeOnly: true,
            moduleSpecifier: this.hasZodPlugin
              ? `../${ZOD_MODEL_FOLDER_NAME}/${_.upperFirst(_.camelCase(key))}`
              : `../${TYPE_MODEL_FOLDER_NAME}/${_.upperFirst(_.camelCase(key))}`,
          },
        ]),
        this.ast.generateFunctionStatements({
          name: _.camelCase(name),
          statements: `return ${this.openapi.getRefAlias(schema.$ref)}()`,
          returnType:
            this.openapi.upperFirstCurrentTagName +
            "." +
            _.upperFirst(_.camelCase(name)),
          isExported: true,
          docs: [], // [{ description: "" }],
        }),
      ],
      fileAddSuffix(key),
    );
  }

  createModelSourceFile(
    statements: Array<StatementStructures>,
    fileName: string,
  ): void {
    const filePath = path.resolve(
      this.openapiToSingleConfig.output.dir || "./",
      MODEL_FOLDER_NAME + "/" + fileName + ".ts",
    );

    this.ast.createSourceFile(filePath, {
      //...(this.generateModelImport() || [])
      statements,
    });

    //
    this.setModelIndexStatements(statements);
  }

  setModelIndexStatements(statements: Array<StatementStructures>): void {
    //
    const whiteKind = [StructureKind.ImportDeclaration];

    const names = _.chain(statements)
      .filter((item) => whiteKind.includes(item.kind))
      .filter(
        (item) =>
          "moduleSpecifier" in item &&
          item.moduleSpecifier !== "@faker-js/faker",
      )
      .map((item: ImportDeclarationStructure) =>
        _.get(item, "namedImports[0]", ""),
      )
      .map((item: string) => _.camelCase(item))
      .value() as unknown as string[];

    _.forEach(names, (name) => this.modelIndex.add(name));
  }

  generateModelIndex(): void {
    const statements = _.chain([...this.modelIndex])
      .map((name) => {
        const fileName = name.endsWith(_.upperFirst(FAKER_SUFFIX))
          ? name
          : fileAddSuffix(name);
        return this.ast.generateExportStatements({
          moduleSpecifier: "./" + fileName,
        });
      })
      .value();

    this.createModelSourceFile(statements, "index");
  }

  /**
   * schema type
   * @param schema
   * @param key
   */
  generateCodeForComponentSchema(schema: SchemaObject, key: string): void {
    const name = fakerNameAddSuffix(key);
    this.openapi.resetRefCache();
    const schemaStatements = this.ast.generateFunctionStatements({
      name: _.camelCase(name),
      statements: `return ${this.schema.getStatementsFromSchema(schema)}`,
      returnType: _.upperFirst(_.camelCase(key)),
      isExported: true,
      docs: schema.description ? [{ description: schema.description }] : [],
    });

    const importStatements = _.chain([...this.openapi.refCache.keys()])
      .map((ref) => {
        const name = this.openapi.getRefAlias(ref);
        return this.ast.generateImportStatements([
          ...(name === key
            ? []
            : [
                {
                  namedImports: [fakerNameAddSuffix(name)],
                  isTypeOnly: false,
                  moduleSpecifier:
                    `./` + refAddSuffix(this.openapi.getRefAlias(ref)),
                },
              ]),
        ]);
      })
      .flatten()
      .value();

    const fakerImport = this.ast.generateImportStatements([
      {
        namedImports: ["faker"],
        isTypeOnly: false,
        moduleSpecifier: `@faker-js/faker`,
      },
      {
        namedImports: [_.upperFirst(_.camelCase(key))],
        isTypeOnly: true,
        moduleSpecifier: `../${TYPE_MODEL_FOLDER_NAME}`,
      },
    ]);

    this.createModelSourceFile(
      [...importStatements, ...fakerImport, schemaStatements],
      fileAddSuffix(key),
    );
  }
}
