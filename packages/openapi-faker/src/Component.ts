import path from "node:path";

import { TYPE_MODEL_FOLDER_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { StructureKind } from "ts-morph";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { Faker } from "./Faker";
import { Schema } from "./Schema.ts";

import type { PluginContext } from "@openapi-to/core";
import type OasTypes from "oas/types";
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
  private readonly modelFolderName: string = modelFolderName;
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
  generateComponentType(): void {
    //todo requestBodies
    //this.generateComponentObjectType(this.openapi.component.requestBodyObject);
    _.forEach(this.openapi.component.schemas, (schema, key) => {
      if (this.openapi.isReference(schema)) {
        this.generateComponentRefType(schema, key);
        return;
      }

      this.generateComponentSchemaType(schema, key);
    });
  }

  generateComponentRefType(
    schema: OpenAPIV3.ReferenceObject,
    typeName: string,
  ): void {
    this.createModelSourceFile(
      [
        ...this.ast.generateImportStatements([
          {
            namedImports: ["faker"],
            isTypeOnly: false,
            moduleSpecifier: `@faker-js/faker`,
          },
          {
            namedImports: [this.openapi.getRefAlias(schema.$ref)],
            isTypeOnly: false,
            moduleSpecifier: `/${this.modelFolderName}/index`,
          },
          {
            namedImports: [_.upperFirst(_.camelCase(typeName))],
            isTypeOnly: true,
            moduleSpecifier: `../${TYPE_MODEL_FOLDER_NAME}/${_.upperFirst(_.camelCase(typeName))}`,
          },
        ]),
        this.ast.generateFunctionStatements({
          name: _.camelCase(typeName),
          statements: `return ${this.openapi.getRefAlias(schema.$ref)}()`,
          returnType:
            this.openapi.upperFirstCurrentTagName +
            "." +
            _.upperFirst(_.camelCase(typeName)),
          isExported: true,
          docs: [{ description: "" }],
        }),
      ],
      _.upperFirst(_.camelCase(typeName)),
    );
  }

  createModelSourceFile(
    statements: Array<StatementStructures>,
    fileName: string,
  ): void {
    const filePath = path.resolve(
      this.openapiToSingleConfig.output || "./",
      this.modelFolderName + "/" + fileName + ".ts",
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
      .map((name) =>
        this.ast.generateExportStatements({
          moduleSpecifier: "./" + name,
        }),
      )
      .value();

    this.createModelSourceFile(statements, "index");
  }

  /**
   * schema type
   * @param schema
   * @param typeName
   */
  generateComponentSchemaType(
    schema: OasTypes.SchemaObject,
    typeName: string,
  ): void {
    this.openapi.resetRefCache();

    const schemaStatuments = this.ast.generateFunctionStatements({
      name: _.camelCase(typeName),
      statements: `return ${this.schema.getStatementsFromSchema(schema)}`,
      returnType: _.upperFirst(_.camelCase(typeName)),
      isExported: true,
      docs: [{ description: schema.description || "" }],
    });

    const importStatements = _.chain([...this.openapi.refCache.keys()])
      .map((ref) => {
        return this.ast.generateImportStatements([
          {
            namedImports: [_.camelCase(this.openapi.getRefAlias(ref))],
            isTypeOnly: false,
            moduleSpecifier: `./` + _.camelCase(this.openapi.getRefAlias(ref)),
          },
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
        namedImports: [_.upperFirst(_.camelCase(typeName))],
        isTypeOnly: true,
        moduleSpecifier: `../${TYPE_MODEL_FOLDER_NAME}`,
      },
    ]);

    this.createModelSourceFile(
      [...importStatements, ...fakerImport, schemaStatuments],
      _.camelCase(typeName),
    );
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
      | OasTypes.MediaTypeObject
      | undefined = _.head(Object.values(componentObject));

    if (!name || !value) {
      return;
    }

    if (this.openapi.isReference(value)) {
      this.generateComponentRefType(value, typeName);
      return;
    }

    let schema: OasTypes.SchemaObject | null = null;

    if ("schema" in value) {
      schema = value.schema || (null as OasTypes.SchemaObject | null);
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
