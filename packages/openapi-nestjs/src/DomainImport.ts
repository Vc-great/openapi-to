import path from "node:path";

import { OpenAPI } from "@openapi-to/core";

import _ from "lodash";

import { DOMAIN_DIR, OUTPUT_DIR } from "./constants.ts";

import type { OpenAPIResponseObject } from "@openapi-to/core";
import type { Operation } from "oas/operation";
import type OasTypes from "oas/types";
import type { Config, ImportStatementsOmitKind } from "./types.ts";

type ArraySchemaObject = Omit<OasTypes.SchemaObject, "type"> & {
  type: "array";
};

type ObjectSchemaObject = Omit<OasTypes.SchemaObject, "type"> & {
  type: "object";
};

export class DomainImport {
  operation: Operation | undefined;
  oas: Config["oas"];
  readonly openapi: Config["openapi"];
  readonly ast: Config["ast"];
  readonly pluginConfig: Config["pluginConfig"];
  readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
  }

  generateQueryDtoModuleSpecifier(operationId: string): string {
    return "./" + DOMAIN_DIR + "/" + `${operationId}-query.dto`;
  }
  generateQueryDtoFilePath(
    currentTagName: string,
    queryDtoModuleSpecifier: string,
  ): string {
    return path.join(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      `./${currentTagName}`,
      queryDtoModuleSpecifier + ".ts",
    );
  }

  generateQueryDtoName(operationId: string): string {
    return `${_.upperFirst(operationId)}QueryDto`;
  }

  //todo 没有ref 1. object 2.其他
  generateBodyDtoName(requestBodyRefName: string | undefined): string {
    return `${requestBodyRefName || ""}`;
  }
  generateBodyDtoFilePath(
    currentTagName: string,
    bodyDtoModuleSpecifier: string,
  ): string {
    return path.join(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      `./${currentTagName}`,
      bodyDtoModuleSpecifier + ".ts",
    );
  }

  generateBodyDtoModuleSpecifier(bodyDtoName?: string): string {
    return `./${DOMAIN_DIR}/${bodyDtoName}.dto`;
  }

  generateModuleSpecifier(responseRefName: string): string {
    return `./${DOMAIN_DIR}/${
      responseRefName.endsWith("Vo")
        ? responseRefName.slice(0, -2)
        : responseRefName
    }.vo`;
  }

  generateResponseModuleSpecifier(responseRefName: string): string {
    return `./${DOMAIN_DIR}/${
      responseRefName.endsWith("Vo")
        ? responseRefName.slice(0, -2)
        : responseRefName
    }.vo`;
  }

  generateResponseDtoFilePath(
    currentTagName: string,
    responseModuleSpecifier: string,
  ): string {
    return path.resolve(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      `./${currentTagName}`,
      responseModuleSpecifier + ".ts",
    );
  }

  getResponseRefName(
    responseSchema: OpenAPIResponseObject | undefined,
  ): string | undefined {
    return (
      responseSchema?.refName ||
      _.get(responseSchema, "schema.items.$ref", "").replace(/.+\//, "")
    );
  }

  domainImportStatementsOfControllerServiceRepository(): Array<ImportStatementsOmitKind> {
    const openapi = new OpenAPI({}, this.oas);

    const currentPathGroupByTag = _.chain(this.openapi.pathGroupByTag)
      .filter((pathGroup, tag) => tag === this.openapi.currentTagName)
      .head()
      .value();

    const cacheNamedImports: Set<string> = new Set();

    return _.chain(currentPathGroupByTag)
      .map(({ path, method, tag }) => {
        const operation = openapi.setCurrentOperation(path, method, tag);
        const domainImports = [];
        const queryDtoName = this.generateQueryDtoName(openapi.operationId);
        const queryDtoModuleSpecifier = this.generateQueryDtoModuleSpecifier(
          openapi.operationId,
        );
        if (
          openapi.parameter?.hasQueryParameters &&
          !cacheNamedImports.has(queryDtoName)
        ) {
          cacheNamedImports.add(queryDtoName);
          domainImports.push({
            namedImports: [queryDtoName],
            moduleSpecifier: queryDtoModuleSpecifier,
          });
        }

        const bodyDtoName = this.generateBodyDtoName(
          openapi.requestBody?.requestBodyRefName,
        );

        if (
          bodyDtoName &&
          openapi.requestBody?.hasRequestBody &&
          !cacheNamedImports.has(bodyDtoName)
        ) {
          cacheNamedImports.add(bodyDtoName);
          domainImports.push({
            namedImports: [bodyDtoName],
            moduleSpecifier: this.generateBodyDtoModuleSpecifier(bodyDtoName),
          });
        }

        const responseRefName = this.getResponseRefName(
          openapi.response?.successResponse,
        );

        if (responseRefName && !cacheNamedImports.has(responseRefName)) {
          cacheNamedImports.add(responseRefName);
          domainImports.push({
            namedImports: [responseRefName],
            moduleSpecifier: this.generateModuleSpecifier(responseRefName),
          });
        }
        return domainImports;
      })
      .flatten()
      .filter(Boolean)
      .value() as Array<ImportStatementsOmitKind>;
  }

  generateDomainNamedImportsBySchema(
    schemaObject: OasTypes.SchemaObject,
  ): string[] | undefined {
    switch (schemaObject.type) {
      case "array":
        return this.getNamedImportsByArray(schemaObject as ArraySchemaObject);
      case "object":
        return this.getNamedImportsByObject(schemaObject as ObjectSchemaObject);
      default:
        return [];
    }
  }

  getNamedImportsByObject(schemaObject: ObjectSchemaObject) {
    const propertyType = _.chain(schemaObject?.properties)
      .reduce((arr: Array<string>, value) => {
        if (typeof value === "object" && "$ref" in value) {
          arr.push(this.openapi.getDomainNameByRef(_.get(value, "$ref", "")));
        }

        const type =
          typeof value === "object" && "type" in value ? value?.type : "";
        switch (type) {
          case "array":
            arr.push(
              this.openapi.getDomainNameByRef(_.get(value, "items.$ref", "")),
            );
            break;
          case "object":
            arr.push(this.openapi.getDomainNameByRef(_.get(value, "$ref", "")));
            break;
        }

        return arr.filter(Boolean);
      }, [])
      .value();
    return propertyType;
  }

  getNamedImportsByArray(
    schemaObject: ArraySchemaObject,
  ): string[] | undefined {
    const ref = _.get(schemaObject, "schema.items.$ref", "").replace(
      /.+\//,
      "",
    );
    return ref ? [ref] : undefined;
  }

  mergeNamedImports(
    imports: ImportStatementsOmitKind[],
  ): ImportStatementsOmitKind[] {
    return _.chain(imports)
      .reduce((arr: ImportStatementsOmitKind[], item) => {
        const importStatement = _.find(
          arr,
          (x) => item.moduleSpecifier === x.moduleSpecifier,
        );
        if (importStatement) {
          item.namedImports.forEach((x) =>
            importStatement.namedImports.push(x),
          );
        }
        return [...arr, item];
      }, [])
      .value();
  }
}
