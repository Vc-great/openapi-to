import path from "node:path";

import { NUMBER_ENUM } from "@openapi-to/core";

import _ from "lodash";

import { ValidatorDecorator } from "./domainGenerator/ValidatorDecorator.ts";
import { OUTPUT_DIR } from "./constants.ts";
import { DomainImport } from "./DomainImport.ts";

import type { OpenAPIParameterObject } from "@openapi-to/core";
import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type {
  DecoratorStructure,
  OptionalKind,
  ParameterDeclarationStructure,
} from "ts-morph";
import type { Config, ImportStatementsOmitKind } from "./types.ts";

type Parameters = OptionalKind<
  Omit<ParameterDeclarationStructure, "type"> & { type: string }
>;

export class NestjsGenerator {
  protected operation: Operation | undefined;
  protected oas: Config["oas"];
  protected readonly openapi: Config["openapi"];
  protected readonly ast: Config["ast"];
  protected readonly pluginConfig: Config["pluginConfig"];
  protected readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  protected validatorDecorator: ValidatorDecorator;
  domainImport: DomainImport;

  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.domainImport = new DomainImport(config);
    this.validatorDecorator = new ValidatorDecorator(config);
  }

  get intersectionTypeImport(): ImportStatementsOmitKind {
    return {
      namedImports: ["IntersectionType"],
      moduleSpecifier: "@nestjs/swagger",
    };
  }

  get injectableImportStatement(): Omit<
    ImportStatementsOmitKind,
    "namedImports"
  > & { namedImports: Array<string> } {
    return {
      namedImports: ["Injectable"],
      moduleSpecifier: "@nestjs/common",
    };
  }

  get transformerImportStatement(): ImportStatementsOmitKind {
    return {
      namedImports: ["plainToInstance"],
      moduleSpecifier: 'class-transformer',
    };
  }

  get controllerClassName(): string {
    return `${_.upperFirst(this.openapi.currentTagName)}Controller`;
  }

  get serviceClassName(): string {
    return `${_.upperFirst(this.openapi.currentTagName)}Service`;
  }

  get repositoryClassName(): string {
    return `${_.upperFirst(this.openapi.currentTagName)}Repository`;
  }

  get resourcePath(): string {
    return path.resolve(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      this.openapi.currentTagName,
    );
  }

  get controllerFilePath(): string {
    return path.resolve(
      this.resourcePath,
      `${this.openapi.currentTagName}.controller.ts`,
    );
  }

  get serviceFilePath(): string {
    return path.resolve(
      this.resourcePath,
      `${this.openapi.currentTagName}.service.ts`,
    );
  }

  get serviceModuleSpecifier(): string {
    return `./${this.openapi.currentTagName}.service`;
  }

  get repositoryName(): string {
    return `${this.openapi.currentTagName}Repository`;
  }

  get repositoryModuleSpecifier(): string {
    return `./repository/${this.openapi.currentTagName}.repository`;
  }

  get repositoryDirectory() {
    return path.resolve(this.resourcePath, "repository");
  }

  get repositoryFilePath(): string {
    return path.resolve(
      this.repositoryDirectory,
      `${this.openapi.currentTagName}.repository.ts`,
    );
  }

  get repositoryModuleFilePath(): string {
    return path.resolve(
      this.repositoryDirectory,
      `${this.openapi.currentTagName}-repository.module.ts`,
    );
  }

  get repositoryMapperFilePath(): string {
    return path.resolve(
      this.repositoryDirectory,
      `${this.openapi.currentTagName}.mapper.ts`,
    );
  }

  get responseVoName() {
    return this.openapi.response?.successResponse?.refName;
  }

  get entityName() {
    return `${this.openapi.currentTagName}Entity`;
  }

  get entityModuleSpecifier(): string {
    return `../entities/${this.openapi.currentTagName}.entity.ts`;
  }

  get methodName(): string {
    return this.openapi.operationId || _.camelCase(this.openapi.methodName);
  }

  get queryDtoFilePath(): string {
    return this.domainImport.generateQueryDtoFilePath(
      this.openapi.currentTagName,
      this.queryDtoModuleSpecifier,
    );
  }

  get queryDtoModuleSpecifier() {
    return this.domainImport.generateQueryDtoModuleSpecifier(
      this.openapi.operationId,
    );
  }

  get queryDtoName(): string {
    return this.domainImport.generateQueryDtoName(this.openapi.operationId);
  }

  get BodyDtoName(): string {
    return this.domainImport.generateBodyDtoName(
      this.openapi.requestBody?.requestBodyRefName,
    );
  }

  get bodyDtoFilePath(): string {
    return this.domainImport.generateBodyDtoFilePath(
      this.openapi.currentTagName,
      this.bodyDtoModuleSpecifier,
    );
  }

  get bodyDtoModuleSpecifier(): string {
    return this.domainImport.generateBodyDtoModuleSpecifier(this.BodyDtoName);
  }

  get responseDtoFilePath(): string {
    return this.domainImport.generateResponseDtoFilePath(
      this.openapi.currentTagName,
      this.responseModuleSpecifier,
    );
  }

  get responseModuleSpecifier(): string {
    const responseRefName = this.successResponseRefName;

    return this.domainImport.generateResponseModuleSpecifier(responseRefName);
  }

  get successResponseRefName(): string {
    const responseSchema = this.openapi.response?.successResponse;

    return (
      responseSchema?.refName ||
      _.get(responseSchema, "schema.items.$ref", "").replace(/.+\//, "")
    );
  }

  get domainImportStatements(): Array<ImportStatementsOmitKind> {
    return this.domainImport.domainImportStatementsOfControllerServiceRepository();
  }

  validatorImportsOfParameters(
    parameters: Array<OpenAPIParameterObject>,
  ): ImportStatementsOmitKind {
    const namedImports = _.chain(parameters)
      .filter((item) => !item.$ref)
      .reduce((validatorImports, item) => {
        const schema = item.schema as SchemaObject;
        const validatorDecorator = this.validatorDecorator.generatorDecorator(
          schema,
          item.required,
        );
        validatorDecorator?.forEach((validator) =>
          validatorImports.add(validator.name),
        );
        return validatorImports;
      }, new Set())
      .value() as Set<string>;

    return {
      namedImports: [...namedImports],
      moduleSpecifier: "class-validator",
    };
  }

  validatorImportsOfSchema(
    schemaObject: SchemaObject | undefined,
  ): ImportStatementsOmitKind | undefined {
    if (schemaObject === undefined) {
      return undefined;
    }
    const validatorNamedImports =
      this.validatorDecorator.ValidatorNames(schemaObject);

    return _.isEmpty(validatorNamedImports)
      ? undefined
      : {
          namedImports: validatorNamedImports,
          moduleSpecifier: "class-validator",
        };
  }

  generateDomainImportsBySchema(
    schemaObject: SchemaObject,
  ): Array<ImportStatementsOmitKind> | undefined {
    const namedImports =
      this.domainImport.generateDomainNamedImportsBySchema(schemaObject);

    return _.chain(namedImports)
      .map((item) => {
        return {
          namedImports: [item],
          moduleSpecifier: item,
        };
      })
      .value();
  }

  generateCommonDomainImports(
    names: Array<string> | undefined,
  ): ImportStatementsOmitKind | undefined {
    return names
      ? {
          namedImports: names,
          moduleSpecifier: "@/common/domain",
        }
      : undefined;
  }

  generateValidatorImports(
    validatorDecorator: OptionalKind<DecoratorStructure>[],
  ): ImportStatementsOmitKind {
    const validatorImports = new Set();

    validatorDecorator.forEach((validator) =>
      validatorImports.add(validator.name),
    );

    return {
      namedImports: [...validatorImports] as string[],
      moduleSpecifier: "class-validator",
    };
  }

  /**
   * @example
   * ```
   * Promise<FindOneVo>
   * ```
   */
  generatorReturnType(): string {
    const responseSchema = this.openapi.response?.successResponse;

    const refName = this.successResponseRefName;

    const isArray = responseSchema?.type === "array";
    const handleRefName = refName
      ? `${refName}${isArray ? "[]" : ""}`
      : undefined;

    return `Promise<${handleRefName ?? "void"}>`;
  }

  get queryParameters(): Parameters {
    return {
      name: "query",
      type: this.queryDtoName,
      decorators: [],
    };
  }

  get pathParameters(): Parameters[] {
    return _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: OpenAPIV3.ParameterObject) => {
        //todo other type
        const pathType =
          (item.schema && "type" in item.schema && item.schema.type) ??
          "string";
        return {
          name: _.camelCase(item.name),
          type: NUMBER_ENUM.includes(pathType || "") ? "number" : pathType,
          decorators: [],
        };
      })
      .value() as unknown as Parameters[];
  }
  get bodyParameters(): Parameters {
    const arrayBody = this.openapi.requestBody?.arrayBody;

    return {
      name: 'data',
      type:
        `${this.BodyDtoName
          ? this.BodyDtoName
          : this.openapi.formatterSchemaType(
              _.get(arrayBody ?? {}, "schemaObject.type", "any"),
            )}${arrayBody?.isArray ? "[]" : ""}`,
      decorators: [],
    };
  }

  /**
   * @example
   * ```
   * createUserDto: CreateUpdateUserDto
   * ```
   */
  generatorMethodParameters(): OptionalKind<ParameterDeclarationStructure>[] {
    return _.chain([] as OptionalKind<ParameterDeclarationStructure>[])
      .concat(
        this.openapi.parameter?.hasPathParameters ? this.pathParameters : [],
      )
      .concat(
        this.openapi.parameter?.hasQueryParameters ? this.queryParameters : [],
      )
      .concat(
        this.openapi.requestBody?.hasRequestBody ? this.bodyParameters : [],
      )
      .filter(Boolean)
      .value();
  }

  mergeNamedImports(
    imports: ImportStatementsOmitKind[],
  ): ImportStatementsOmitKind[] {
    return this.domainImport.mergeNamedImports(imports);
  }

  handleDtoFileName(dtoName: string): string {
    return _.chain(dtoName.endsWith("Dto") ? dtoName.slice(0, -2) : dtoName)
      .lowerFirst()
      .kebabCase()
      .value();
  }
}
