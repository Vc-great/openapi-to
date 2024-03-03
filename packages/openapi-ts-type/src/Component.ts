import path from "node:path";

import _ from "lodash";
import { StructureKind } from "ts-morph";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { Schema } from "./Schema.ts";

import type { PluginContext } from "@openapi-to/core";
import type OasTypes from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type {
  InterfaceDeclarationStructure,
  StatementStructures,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { Config } from "./types.ts";
export class Component {
  private oas: Config["oas"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private readonly modelFolderName: string = modelFolderName;
  private context: PluginContext | null = null;
  private modelIndex: Set<string> = new Set<string>(["enum"]);
  private schema: Schema;
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.schema = new Schema(config);
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
            namedImports: [_.upperFirst(this.openapi.getRefAlias(schema.$ref))],
            isTypeOnly: true,
            moduleSpecifier: `/model/index`,
          },
        ]),
        this.ast.generateTypeAliasStatements({
          name: _.upperFirst(_.camelCase(typeName)),
          type: _.upperFirst(this.openapi.getRefAlias(schema.$ref)),
          //todo
          docs: [{ description: "" }],
          isExported: true,
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

    const schemaStatuments = this.ast.generateInterfaceStatements({
      isExported: true,
      name: _.upperFirst(_.camelCase(typeName)),
      //todo
      docs: [{ description: schema.description || "" }],
      properties: this.schema.getBaseTypeFromSchema(schema),
    });
    const importStatements = _.chain([...this.openapi.refCache.keys()])
      .map((ref) => {
        return this.ast.generateImportStatements([
          {
            namedImports: [_.upperFirst(this.openapi.getRefAlias(ref))],
            isTypeOnly: true,
            moduleSpecifier: "./" + _.upperFirst(this.openapi.getRefAlias(ref)),
          },
        ]);
      })
      .flatten()
      .value();

    this.createModelSourceFile(
      [...importStatements, schemaStatuments],
      _.upperFirst(_.camelCase(typeName)),
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
