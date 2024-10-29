import { UUID_TAG_NAME } from "@openapi-to/core/utils";

import _ from "lodash";
import { Project } from "ts-morph";

import { UUIDPrefix } from "./utils/UUIDPrefix.ts";

import type {
  InterfaceDeclaration,
  JSDoc,
  ModuleDeclaration,
  SourceFile,
  TypeAliasDeclaration,
} from "ts-morph";
import type { Config } from "./types.ts";

export class TypeOldNode {
  public currentSourceFile: SourceFile | undefined;
  private sourceFileCache: Map<string, SourceFile> = new Map<
    string,
    SourceFile
  >();

  constructor(
    private pluginConfig: Config["pluginConfig"],
    private openapiToSingleConfig: Config["openapiToSingleConfig"],
  ) {
    this.pluginConfig = pluginConfig;
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.setSourceFile();
  }

  get baseName(): string {
    return this.currentSourceFile?.getBaseName() || "";
  }

  get currentNamespace(): ModuleDeclaration | undefined {
    return _.head(this.currentSourceFile?.getModules());
  }

  get namespaceName(): string | undefined {
    return this.currentNamespace?.getName();
  }

  get declarationCache(): Map<
    string,
    InterfaceDeclaration | TypeAliasDeclaration
  > {
    return new Map<string, InterfaceDeclaration | TypeAliasDeclaration>([
      ...this.interfaceDeclarationCache,
      ...this.typeDeclarationCache,
    ]);
  }

  get interfaceDeclarationCache(): Map<string, InterfaceDeclaration> {
    return _.chain([...this.sourceFileCache.entries()])
      .filter(([, value]) => !_.isEmpty(value.getInterfaces()))
      .reduce((mapCache, [key, value]) => {
        mapCache.set(
          key,
          _.head(value.getInterfaces()) as InterfaceDeclaration,
        );
        return mapCache;
      }, new Map<string, InterfaceDeclaration>())
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
    const folderName = this.openapiToSingleConfig.output.dir + "/**/*.ts";
    const sourceFiles = project.addSourceFilesAtPaths(folderName);
    _.forEach(sourceFiles, (sourceFile) => {
      const moduleDeclaration = _.head(sourceFile.getModules());
      const interfaceDeclaration = _.head(sourceFile.getInterfaces());
      if (
        _.isUndefined(moduleDeclaration) &&
        _.isUndefined(interfaceDeclaration)
      ) {
        return;
      }

      _.chain([] as Array<string>)
        .concat(
          moduleDeclaration ? this.uuid(moduleDeclaration?.getJsDocs()) : [],
        )
        .concat(
          interfaceDeclaration
            ? this.uuid(interfaceDeclaration?.getJsDocs())
            : [],
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
