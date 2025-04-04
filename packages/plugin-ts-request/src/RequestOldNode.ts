import { UUID_TAG_NAME } from "@openapi-to/core/utils";

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

export class RequestOldNode {
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
    const namedImport = _.chain([...this.methodCache.values()])
      .map(({ methodDeclaration }) => methodDeclaration?.getParameters())
      .flatten()
      .filter(Boolean)
      .map((parameterDeclaration) =>
        parameterDeclaration.getTypeNode()?.getText(),
      )
      .filter(Boolean)
      .map((typeStr) => typeStr?.split(".")[0])
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

  get zodNamespace(): ImportNameSpace {
    const responseZodDecorator = _.chain([...this.methodCache.values()])
      .map(({ methodDeclaration }) =>
        methodDeclaration?.getDecorator("responseZodSchema"),
      )
      .filter(Boolean)
      .head()
      .value();

    const namedImport = _.chain(responseZodDecorator?.getArguments())
      .map((x) => x.getText())
      .map((x) => x.split(".")[0])
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

  get zodDecoratorImport(): Omit<ImportNameSpace, "namedImport"> {
    const moduleSpecifier = _.chain(this.importDeclarations)
      .filter((x) => {
        const namedImports = x.getNamedImports();
        return namedImports.some((item) => item.getName() === "zodValidate");
      })
      .map((x) => x.getModuleSpecifierValue())
      .head()
      .value();

    return {
      moduleSpecifier,
    };
  }

  get requestImport(): Omit<ImportNameSpace, "namedImport"> {
    const moduleSpecifier = _.chain(this.importDeclarations)
      .filter((x) => {
        const namedImports = x.getNamedImports();
        return namedImports.some((item) => item.getName() === "request");
      })
      .map((x) => x.getModuleSpecifierValue())
      .head()
      .value();

    return {
      moduleSpecifier,
    };
  }

  get methodName(): string | undefined {
    return this.currentMethod?.methodDeclaration.getName() || undefined;
  }

  get methodFullText(): string | undefined {
    return this.currentMethod?.methodDeclaration.getFullText() || undefined;
  }

  get paramsSerializer(): string | undefined {
    const extractParamsSerializer = /paramsSerializer\(([^)]+)\) {([^}]+)}/;

    return _.head(this.methodFullText?.match(extractParamsSerializer));
  }

  setSourceFile(): void {
    if (!this.pluginConfig?.compare) {
      return;
    }

    const project = new Project();
    const folderName = `${this.openapiToSingleConfig.output.dir}/*.ts`;
    const sourceFiles = project.addSourceFilesAtPaths(folderName);
    _.forEach(sourceFiles, (sourceFile) => {
      const classDeclaration = _.head(sourceFile.getClasses());
      if (_.isUndefined(classDeclaration)) {
        return;
      }
      const uuid = this.uuid(classDeclaration.getJsDocs());
      if (uuid?.startsWith("API-")) {
        this.sourceFileCache.set(uuid, sourceFile);
      }
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
