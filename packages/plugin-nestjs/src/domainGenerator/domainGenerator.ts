import _ from "lodash";
import { StructureKind } from "ts-morph";

import { NestjsGenerator } from "../NestjsGenerator.ts";
import { Component } from "./Component.ts";
import { Pagination } from "./Pagination.ts";
import { Schema } from "./Schema.ts";
import { SwaggerGenerator } from "./SwaggerGenerator.ts";

import type {
  OpenAPIParameterObject,
  OpenAPIRequestBodyObject,
  OpenAPIResponseObject,
  PluginContext,
} from "@openapi-to/core";
import type { SchemaObject } from "oas/types";
import type { OptionalKind, PropertyDeclarationStructure } from "ts-morph";
import type { ClassDeclarationStructure } from "ts-morph";
import type { Config } from "../types.ts";

export class DomainGenerator extends NestjsGenerator {
  private component: Component;
  private schema: Schema;

  private swaggerGenerator: SwaggerGenerator;

  constructor(config: Config) {
    super(config);

    this.schema = new Schema(config);
    this.component = new Component(config);

    this.swaggerGenerator = new SwaggerGenerator(config);
  }

  build(context: PluginContext): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      _.forEach(pathGroup, ({ path, method, tag }) => {
        this.operation = this.openapi.setCurrentOperation(path, method, tag);

        this.generateParametersDto();
        this.generateRequestBodyDto();
        this.generateResponseDto();
      });
    });
    this.component.build();
  }

  generateQueryDto() {
    const pagination = new Pagination(
      this.openapi.parameter?.parametersOfQuery,
    );
    const parameters = pagination.filterPaginationByParameters;

    const queryExtends = _.chain(parameters)
      .filter((item: OpenAPIParameterObject) => Boolean(item.$ref))
      .map((item) => _.upperFirst(item.refName as string))
      .concat(pagination.addPaginationDtoName ?? [])
      .join(",")
      .value();

    const queryStatements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      extends: queryExtends ? `IntersectionType(${queryExtends})` : "",
      name: this.queryDtoName,
      decorators: [],
      docs: [],
      methods: [],
      properties: _.chain(this.openapi.parameter?.parametersOfQuery)
        .filter((item) => !item.$ref)
        .map((item) => {
          const schema = item.schema as SchemaObject;
          const validatorDecorator =
            this.validatorDecorator.generatorDecorator(schema, item.required) ??
            [];
          return {
            leadingTrivia: "\n",
            kind: StructureKind.PropertySignature,
            name: item.name,
            type: schema ? this.schema.getSchemaType(schema) : "unknown",
            hasQuestionToken: !item.required,
            initializer: JSON.stringify(schema?.default) || "",
            decorators: [
              ...validatorDecorator,
              ...(item
                ? this.swaggerGenerator.generatorDecoratorFromParameterObject(
                    item,
                  )
                : []),
            ].filter(Boolean),
          };
        })
        //todo type
        .value() as OptionalKind<PropertyDeclarationStructure>[],
    };

    if (!_.isEmpty(queryStatements.properties)) {
      const parametersOfQuery = this.openapi.parameter?.parametersOfQuery;
      this.ast.createSourceFile(this.queryDtoFilePath, {
        statements: [
          ...this.ast.generateImportStatements(
            this.mergeNamedImports(
              [queryExtends ? this.intersectionTypeImport : undefined]
                .concat(
                  parametersOfQuery
                    ? [
                        this.validatorImportsOfParameters(parametersOfQuery),
                        this.swaggerGenerator.apiPropertyImport,
                      ]
                    : undefined,
                )
                .filter(Boolean),
            ),
          ),
          this.ast.generateClassStatements(queryStatements),
        ],
      });
    }
  }

  generateParametersDto(): void {
    this.generateQueryDto();
  }

  generateResponseDto(): void {
    this.generateResponseSingleSchema(this.openapi.response?.successResponse);
  }

  generateResponseSingleSchema(
    responseObject: OpenAPIResponseObject | undefined,
  ): void {
    if (responseObject === undefined) {
      return;
    }
    if (!responseObject.refName && !responseObject.schema) {
      return;
    }

    const schema = responseObject?.schema;
    const description = responseObject?.description;

    const className = `${_.upperFirst(this.operation?.getOperationId())}Vo`;

    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      extends: responseObject.refName
        ? `IntersectionType(${responseObject.refName})`
        : undefined,
      name: `${className}`,
      decorators: [],
      docs: description
        ? [
            {
              description: "\n",
              tags: [
                {
                  tagName: "description",
                  text: description,
                },
              ],
            },
          ]
        : [],
      methods: [],
      properties: responseObject.refName
        ? []
        : (this.schema.getPropertyStructureFromSchemaObject(schema)
            ?.propertiesStructure ?? []),
    };

    this.ast.createSourceFile(this.responseDtoFilePath, {
      statements: [
        ...this.ast.generateImportStatements(
          this.mergeNamedImports(
            [
              this.generateCommonDomainImports(
                responseObject.refName ? [responseObject.refName] : undefined,
              ),
            ]
              .concat(
                _.isEmpty(statements.properties)
                  ? []
                  : this.swaggerGenerator.apiPropertyImport,
              )
              .concat(
                responseObject.refName
                  ? [this.intersectionTypeImport]
                  : [this.validatorImportsOfSchema(schema)],
              )
              .filter(Boolean),
          ),
        ),
        this.ast.generateClassStatements(statements),
      ],
    });
  }

  generateRequestBodyDto(): void {
    const requestBodyObject = this.openapi.requestBody
      ?.requestBodyObject as OpenAPIRequestBodyObject;

    if (requestBodyObject === undefined) {
      return;
    }

    if (!requestBodyObject.refName && !requestBodyObject.schemaObject) {
      return;
    }

    const className: string =
      requestBodyObject.refName ||
      this.openapi.getDomainNameByRef(
        _.get(requestBodyObject, "schemaObject.$ref", ""),
      ) ||
      `${this.operation?.getOperationId()}Dto`;

    const schema =
      requestBodyObject.schemaObject &&
      "$ref" in requestBodyObject.schemaObject &&
      requestBodyObject.schemaObject.$ref
        ? (this.openapi.findSchemaDefinition(
            requestBodyObject?.schemaObject.$ref,
          ) as SchemaObject)
        : (requestBodyObject.schemaObject as SchemaObject);

    const propertyStructures =
      this.schema.getPropertyStructureFromSchemaObject(schema);
    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      extends: undefined,
      name: `${className}`,
      decorators: [],
      docs: requestBodyObject.description
        ? [
            {
              description: "\n",
              tags: [
                {
                  tagName: "description",
                  text: requestBodyObject.description,
                },
              ],
            },
          ]
        : [],
      methods: [],
      properties: _.isEmpty(propertyStructures?.propertiesStructure)
        ? []
        : propertyStructures?.propertiesStructure,
    };

    if (!_.isEmpty(statements.properties)) {
      this.ast.createSourceFile(this.bodyDtoFilePath, {
        statements: [
          ...this.ast.generateImportStatements(
            this.mergeNamedImports(
              [this.validatorImportsOfSchema(schema)]
                .concat(
                  _.isEmpty(propertyStructures?.propertiesStructure)
                    ? []
                    : this.swaggerGenerator.apiPropertyImport,
                )
                .concat(
                  schema ? this.generateDomainImportsBySchema(schema) : [],
                )
                .filter(Boolean),
            ),
          ),
          this.ast.generateClassStatements(statements),
        ],
      });
    }
  }
}
