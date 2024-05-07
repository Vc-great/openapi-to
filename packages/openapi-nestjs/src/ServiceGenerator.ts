import _ from "lodash";
import { Scope } from "ts-morph";

import { NestjsGenerator } from "./NestjsGenerator.ts";

import type { PluginContext } from "@openapi-to/core";
import type OasTypes from "oas/types";
import type { ClassDeclarationStructure } from "ts-morph";
import type {
  ImportDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
} from "ts-morph";
import type { Config } from "./types.ts";

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

export class ServiceGenerator extends NestjsGenerator {
  constructor(config: Config) {
    super(config);
  }

  get getResponseStatusCodes() {
    return this.openapi.response?.getResponseStatusCodes;
  }

  build(context: PluginContext): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      const methodsStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);
          return this.generatorMethod();
        })
        .value();

      this.ast.createSourceFile(this.serviceFilePath, {
        statements: [
          ...this.generateImport(),
          this.generatorClass(methodsStatements),
        ],
      });
    });
  }

  generateImport(): Array<ImportDeclarationStructure> {
    const injectable: ImportStatementsOmitKind = {
      namedImports: ["Injectable"],
      moduleSpecifier: "@nestjs/common",
    };

    const repository: ImportStatementsOmitKind = {
      namedImports: [this.repositoryClassName],
      moduleSpecifier: this.repositoryModuleSpecifier,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .push(injectable)
      .push(repository)
      .concat(this.domainImportStatements)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  generatorClass(
    methodsStatements: OptionalKind<MethodDeclarationStructure>[],
  ): ClassDeclarationStructure {
    const statements = {
      name: this.serviceClassName,
      isExported: true,
      decorators: [
        {
          name: "Injectable",
        },
      ],
      docs: [],
      ctors: [
        {
          parameters: [
            {
              isReadonly: true,
              scope: Scope.Private,
              name: _.lowerFirst(this.repositoryClassName),
              type: this.repositoryClassName,
            },
          ],
        },
      ],
      methods: methodsStatements,
    };
    return this.ast.generateClassStatements(statements);
  }

  generatorMethodBody(): string {
    const pathParameters = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: OasTypes.ParameterObject) => _.camelCase(item.name))
      .value() as unknown as string[];

    const args = _.chain([] as string[])
      .concat(this.openapi.parameter?.hasPathParameters ? pathParameters : [])
      .concat(this.openapi.parameter?.hasQueryParameters ? "query" : [])
      .concat(this.openapi.requestBody?.hasRequestBody ? "data" : [])
      .join()
      .value();
    return `return await this.${_.lowerFirst(this.repositoryClassName)}.${this.methodName}(${args})`;
  }

  generatorMethod(): MethodDeclarationStructure {
    const statement = {
      name: this.methodName,
      decorators: [],
      parameters: this.generatorMethodParameters(),
      returnType: this.generatorReturnType(),
      docs: [],
      statements: this.generatorMethodBody(),
      isAsync: true,
    };

    return this.ast.generateMethodStatements(statement);
  }
}
