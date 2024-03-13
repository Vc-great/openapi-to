import _ from "lodash";
import { Project } from "ts-morph";

import type {
  ClassDeclaration,
  ImportDeclaration,
  JSDoc,
  MethodDeclaration,
  SourceFile,
} from "ts-morph";
import type { Config } from "./types.ts";

interface ImportNameSpace {
  namedImport: string;
  moduleSpecifier: string;
}

interface methodCacheValue {
  sort: number;
  uuid: string;
  methodDeclaration: MethodDeclaration;
}

export class FakerOldNode {
  public currentMethod: methodCacheValue | undefined;
  public currentSourceFile: SourceFile | undefined;
  private sourceFileCache: Map<string, SourceFile> = new Map<
    string,
    SourceFile
  >();
  private methodCache: Map<string, methodCacheValue> = new Map<
    string,
    methodCacheValue
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

  get classDeclaration(): ClassDeclaration | undefined {
    return _.head(this.currentSourceFile?.getClasses());
  }

  get importDeclarations(): Array<ImportDeclaration> | undefined {
    return this.currentSourceFile?.getImportDeclarations();
  }

  get typeNamespace(): ImportNameSpace {
    const extractPet = /(?<=<)(\w+)(?=\.\w+>)/;
    const aaa = [...this.methodCache.values()];

    // @ts-ignore
    const namedImport: string = _.chain([...this.methodCache.values()])
      .map(({ methodDeclaration }) => methodDeclaration?.getReturnTypeNode())
      .filter(Boolean)
      .map((typeNode) => typeNode?.getText())
      .filter(Boolean)
      .map((typeStr: string) => _.head(typeStr.match(extractPet)))
      .head()
      .value();

    const moduleSpecifier = _.chain(this.importDeclarations)
      .filter((x) => {
        const namedImports = x.getNamedImports();
        return namedImports.some((item) => item.getName() === namedImport);
      })
      .map((x) => x.getModuleSpecifierValue())
      .head()
      .value();

    return {
      namedImport,
      moduleSpecifier,
    };
  }

  get methodName(): string | undefined {
    return this.currentMethod?.methodDeclaration.getName() || undefined;
  }

  get methodFullText(): string | undefined {
    return this.currentMethod?.methodDeclaration.getFullText() || undefined;
  }

  setSourceFile(): void {
    if (!this.pluginConfig?.compare) {
      return;
    }

    const project = new Project();
    const folderName = this.openapiToSingleConfig.output + "/*.ts";
    const sourceFiles = project.addSourceFilesAtPaths(folderName);
    _.forEach(sourceFiles, (sourceFile) => {
      const classDeclaration = _.head(sourceFile.getClasses());
      if (_.isUndefined(classDeclaration)) {
        return;
      }
      const uuid = this.uuid(classDeclaration.getJsDocs());
      if (uuid && uuid.startsWith("Faker-")) {
        this.sourceFileCache.set(uuid, sourceFile);
      }
    });
  }

  uuid(JsDocs: Array<JSDoc>): string {
    return _.chain(JsDocs)
      .map((x) => x.getTags())
      .flatten()
      .filter((x) => x.getTagName() === "uuid")
      .map((x) => x.getCommentText())
      .head()
      .value();
  }

  setCurrentSourceFile(uuid: string): void {
    if (!this.pluginConfig?.compare) {
      return;
    }

    this.currentSourceFile = this.sourceFileCache.get(uuid);

    _.chain(this.classDeclaration?.getMethods())
      .filter((methodDeclaration) => !!this.uuid(methodDeclaration.getJsDocs()))
      .map((methodDeclaration, index) => {
        return {
          methodDeclaration,
          sort: index,
          uuid: this.uuid(methodDeclaration.getJsDocs()),
        };
      })
      .forEach((x) => this.methodCache.set(x.uuid, x))
      .value();
  }

  setCurrentMethod(methodOperationId: string): void {
    if (!this.pluginConfig?.compare) {
      return;
    }

    this.currentMethod = this.methodCache.get(methodOperationId);
  }
}
