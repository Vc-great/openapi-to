import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { Project } from "ts-morph";

import { UUIDPrefix } from "./utils/UUIDPrefix.ts";

import type { VariableDeclaration } from "ts-morph";
import type { JSDoc, SourceFile, TypeAliasDeclaration } from "ts-morph";
import type { Config } from "./types.ts";

export class ZodOldNode {
  public currentSourceFile: SourceFile | undefined;
  private sourceFileCache: Map<string, SourceFile> = new Map<
    string,
    SourceFile
  >();

  constructor(
    private pluginConfig: Config["pluginConfig"],
    private openapiToSingleConfig: Config["openapiToSingleConfig"],
    private openapi: Config["openapi"],
  ) {
    this.pluginConfig = pluginConfig;
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.openapi = openapi;
    this.setSourceFile();
  }

  get baseName(): string {
    return this.currentSourceFile?.getBaseName() || "";
  }

  get currentZodNamespace(): VariableDeclaration | undefined {
    const a = this.variableDeclarationCache;
    const b = UUIDPrefix + this.openapi.currentTagName
    return this.variableDeclarationCache.get(
      UUIDPrefix + this.openapi.currentTagName
    );
  }

  get zodNameSpaceName(): string | undefined {
    return this.currentZodNamespace?.getName();
  }

  get currentTypeNamespace(): TypeAliasDeclaration | undefined {
    return this.typeDeclarationCache.get(
      UUIDPrefix + this.openapi.currentTagName,
    );
  }

  get TypeNameSpaceName(): string | undefined {
    return this.currentTypeNamespace?.getName();
  }

  get declarationCache(): Map<
    string,
    VariableDeclaration | TypeAliasDeclaration
  > {
    return new Map<string, VariableDeclaration | TypeAliasDeclaration>([
      ...this.variableDeclarationCache,
      ...this.typeDeclarationCache,
    ]);
  }

  get variableDeclarationCache(): Map<string, VariableDeclaration> {
    return _.chain([...this.sourceFileCache.entries()])
      .filter(
        ([, sourceFile]) => !_.isEmpty(sourceFile.getVariableStatements()),
      )
      .reduce((mapCache, [key, sourceFile]) => {
        const variableDeclaration = _.chain(sourceFile.getVariableStatements())
          .filter((variableStatement) => {
            const UUID = this.uuid(variableStatement?.getJsDocs());
            return UUID === key;
          })
          .map((variableStatement) =>
            _.head(variableStatement.getDeclarations()),
          )
          .head()
          .value();

        mapCache.set(key, variableDeclaration);

        return mapCache;
      }, new Map<string, VariableDeclaration>())
      .value();
  }

  get typeDeclarationCache(): Map<string, TypeAliasDeclaration> {
    return _.chain([...this.sourceFileCache.entries()])
      .filter(([, value]) => !_.isEmpty(value.getTypeAliases()))
      .reduce((mapCache, [key, value]) => {
        mapCache.set(
          key,
          _.head(value.getTypeAliases()) as TypeAliasDeclaration,
        );
        return mapCache;
      }, new Map<string, TypeAliasDeclaration>())
      .value();
  }

  setSourceFile(): void {
    if (!this.pluginConfig?.compare) {
      return;
    }

    const project = new Project();
    const folderName = `${this.openapiToSingleConfig.output.dir}/**/*.ts`;
    const sourceFiles = project.addSourceFilesAtPaths(folderName);
    _.forEach(sourceFiles, (sourceFile) => {
      const moduleDeclaration = _.head(sourceFile.getModules());
      const variableStatements = sourceFile.getVariableStatements();
      if (_.isUndefined(moduleDeclaration) && _.isEmpty(variableStatements)) {
        return;
      }

      _.chain([] as Array<string>)
        .concat(
          moduleDeclaration ? this.uuid(moduleDeclaration?.getJsDocs()) : [],
        )
        .concat(
          _.map(variableStatements, (variableDeclaration) =>
            this.uuid(variableDeclaration?.getJsDocs()),
          ),
        )
        .filter(Boolean)
        .forEach((uuid: string) => {
          if (uuid.startsWith(UUIDPrefix)) {
            this.sourceFileCache.set(uuid, sourceFile);
          }
        })
        .value();
    });
  }

  uuid(JsDocs: Array<JSDoc>): string {
    return _.chain(JsDocs)
      .map((x) => x.getTags())
      .flatten()
      .filter((x) => x.getTagName() === UUID_TAG_NAME)
      .map((x) => x.getCommentText())
      .head()
      .value();
  }

  setCurrentSourceFile(uuid: string): void {
    if (!this.pluginConfig?.compare) {
      return;
    }

    this.currentSourceFile = this.sourceFileCache.get(uuid);
  }
}
