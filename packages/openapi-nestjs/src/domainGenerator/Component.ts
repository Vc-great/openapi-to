import path from "node:path";

import _ from "lodash";

import {
  OUTPUT_DIR,
  PARAMETERS_DIR,
  REQUEST_BODIES_DIR,
  RESPONSES_DIR,
  SCHEMA_DIR,
} from "../constants.ts";
import { NestjsGenerator } from "../NestjsGenerator.ts";
import { Pagination } from "./Pagination.ts";
import { Schema } from "./Schema.ts";
import { SwaggerGenerator } from "./SwaggerGenerator.ts";

import type { OpenAPIParameterObject, PluginContext } from "@openapi-to/core";
import type OasTypes from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type {
  ClassDeclarationStructure,
  DecoratorStructure,
  OptionalKind,
} from "ts-morph";
import type { Config, ImportStatementsOmitKind } from "../types.ts";

type Parameter = {
  statements: Omit<ClassDeclarationStructure, "kind">;
  validatorImports: ImportStatementsOmitKind;
} & OpenAPIParameterObject;

export class Component extends NestjsGenerator {
  private readonly modelFolderName: string = "./domain";
  private context: PluginContext | null = null;
  private modelIndex: Set<string> = new Set<string>(["enum"]);
  private schema: Schema;

  private swaggerGenerator: SwaggerGenerator;

  constructor(config: Config) {
    super(config);
    this.schema = new Schema(config);
    this.swaggerGenerator = new SwaggerGenerator(config);
  }

  build() {
    this.generateParametersDto();
    this.generateRequestBodies();
    this.generateResponses();
  }

  generateParametersStatements(item: OpenAPIParameterObject) {
    const schema = item.schema as OasTypes.SchemaObject;
    const isArrayOfSchema = schema.type === "array";

    const validatorDecorator =
      this.validatorDecorator.generatorDecorator(schema, item.required) ?? [];
    const type = (this.schema.getSchemaType(schema) as string) || "any";
    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      extends: "",
      name: _.upperFirst(item.key),
      decorators: [],
      docs: [],
      methods: [],
      properties: [
        {
          leadingTrivia: "\n",
          // kind: StructureKind.PropertySignature,
          name: item.name,
          type: `${type} ${isArrayOfSchema ? "[]" : ""}`,
          hasQuestionToken: !item.required,
          initializer: JSON.stringify(schema.default),
          decorators: [
            ...validatorDecorator,
            ...this.swaggerGenerator.generatorDecoratorFromParameterObject(
              item,
            ),
          ],
        },
      ],
    };

    return {
      statements,
      ...item,
      validatorImports: this.generateValidatorImports(validatorDecorator),
    };
  }

  generatePaginationDto(pagination: Pagination) {
    const pageNoParameterObject = pagination.pageNoParameterObject;
    const pageSizeParameterObject = pagination.pageSizeParameterObject;

    const pageNoValidatorDecorator = this.validatorDecorator.generatorDecorator(
      pageNoParameterObject?.schema as OasTypes.SchemaObject,
      pageNoParameterObject?.required,
    );

    const pageSizeValidatorDecorator =
      this.validatorDecorator.generatorDecorator(
        pageSizeParameterObject?.schema as OasTypes.SchemaObject,
        pageSizeParameterObject?.required,
      );

    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      name: "PaginationDto",
      properties: [
        {
          leadingTrivia: "\n",
          name: pagination.pageNoName,
          type: _.get(
            pagination,
            "pageNoParameterObject.schema.type",
            "string",
          ),
          hasQuestionToken: !pagination.pageNoParameterObject?.required,
          initializer: JSON.stringify(
            _.get(pagination, "pageNoParameterObject.schema.default"),
          ),
          decorators: _.chain([] as OptionalKind<DecoratorStructure>[])
            .concat(
              pagination.pageNoParameterObject?.schema
                ? this.validatorDecorator.generatorDecorator(
                    pagination.pageNoParameterObject?.schema,
                    pagination.pageNoParameterObject?.required,
                  ) ?? []
                : [],
            )
            .concat(
              pagination.pageNoParameterObject
                ? this.swaggerGenerator.generatorDecoratorFromParameterObject(
                    pagination.pageNoParameterObject,
                  )
                : [],
            )
            .filter(Boolean)
            .value(),
        },
        {
          leadingTrivia: "\n",
          name: pagination.pageSizeName,
          type: _.get(
            pagination,
            "pageSizeParameterObject.schema.type",
            "string",
          ),
          hasQuestionToken: !pagination.pageSizeParameterObject?.required,
          initializer: JSON.stringify(
            _.get(pagination, "pageSizeParameterObject.schema.default"),
          ),
          decorators: _.chain([] as OptionalKind<DecoratorStructure>[])
            .concat(
              pagination.pageSizeParameterObject?.schema
                ? this.validatorDecorator.generatorDecorator(
                    pagination.pageSizeParameterObject?.schema,
                    pagination.pageSizeParameterObject?.required,
                  ) ?? []
                : [],
            )
            .concat(
              pagination.pageSizeParameterObject
                ? this.swaggerGenerator.generatorDecoratorFromParameterObject(
                    pagination.pageSizeParameterObject,
                  )
                : [],
            )
            .filter(Boolean)
            .value(),
        },
      ],
    };
    const pageNoValidatorImports = pageNoValidatorDecorator
      ? this.generateValidatorImports(pageNoValidatorDecorator).namedImports
      : [];

    const pageSizeValidatorImports = pageSizeValidatorDecorator
      ? this.generateValidatorImports(pageSizeValidatorDecorator).namedImports
      : [];

    return {
      name: "pagination",
      in: "query",
      refName: undefined,
      $ref: undefined,
      key: "pagination",
      statements,
      validatorImports: {
        namedImports: [
          ...new Set([...pageNoValidatorImports, ...pageSizeValidatorImports]),
        ],
        moduleSpecifier: "class-validator",
      },
    };
  }

  generateParametersDto(): void {
    const pagination = new Pagination(
      this.openapi.parameter?.componentsParameters,
    );
    const parametersStatements: Parameter[] = _.chain(
      pagination.filterPaginationByParameters,
    )
      .map((item) => {
        return this.generateParametersStatements(item);
      })
      .concat(
        pagination.hasPagination ? this.generatePaginationDto(pagination) : [],
      )
      .value();

    parametersStatements.forEach((parameter) => {
      const filePath = path.join(
        this.openapiToSingleConfig.output.dir,
        OUTPUT_DIR,
        PARAMETERS_DIR,
        `${parameter.name}.dto.ts`,
      );
      const nestjsSwagger: ImportStatementsOmitKind = {
        namedImports: ["ApiProperty"],
        moduleSpecifier: "@nestjs/swagger",
      };

      if (!_.isEmpty(parameter.statements.properties)) {
        this.ast.createSourceFile(filePath, {
          statements: [
            ...this.ast.generateImportStatements([
              parameter.validatorImports,
              nestjsSwagger,
            ]),
            this.ast.generateClassStatements(parameter.statements),
          ],
        });
      }
    });
  }

  /**
   * 如果只有一个tag使用,则不生成全局requestBodyDto
   */
  generateRequestBodies(): void {
    const requestBodies = _.filter(
      this.openapi.requestBody?.groupRequestBodyByTag,
      (item) => item.tags.length > 1,
    );

    const requestBody = _.chain(requestBodies)
      .map(({ refName, requestBodyObject }) => {
        const mediaTypeObjects = _.chain(requestBodyObject.content)
          .values()
          .map((item) => {
            if (item.schema && "$ref" in item.schema) {
              return this.openapi.findSchemaDefinition(item.schema.$ref);
            }
            return item.schema;
          })
          .filter(Boolean)
          .value() as OasTypes.SchemaObject[];

        return {
          refName,
          schema: _.head(mediaTypeObjects),
          description: requestBodyObject.description,
        };
      })
      .value() as {
      refName: string;
      schema: OasTypes.SchemaObject;
      description: string;
    }[];

    _.chain(requestBody)
      .forEach(({ refName, schema, description }) => {
        this.generateDtoBySchema({
          description,
          refName,
          schema,
        });
      })
      .value();
  }

  generateDtoBySchema({
    description,
    refName,
    schema,
  }: {
    description: string | undefined;
    refName: string;
    schema: OasTypes.SchemaObject;
  }) {
    //t { propertiesStructure, validatorImports }
    const property = this.schema.getPropertyStructureFromSchemaObject(schema);

    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      name: `${refName}`,
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
      properties: property?.propertiesStructure ?? [],
    };

    const filePath = path.join(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      REQUEST_BODIES_DIR,
      _.kebabCase(refName.endsWith("Dto") ? refName.slice(0, -2) : refName) +
        ".dto.ts",
    );

    const nestjsSwagger: ImportStatementsOmitKind = {
      namedImports: ["ApiProperty"],
      moduleSpecifier: "@nestjs/swagger",
    };

    const importSchemas: ImportStatementsOmitKind = {
      namedImports: property?.namedImports ?? [],
      moduleSpecifier: "./" + SCHEMA_DIR,
    };

    if (!_.isEmpty(statements.properties)) {
      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.ast.generateImportStatements(
            this.mergeNamedImports(
              [
                nestjsSwagger,
                this.generateValidatorImports(
                  property?.validatorDecorator || [],
                ),
                importSchemas,
              ].filter((item) => !_.isEmpty(item.namedImports)),
            ),
          ),
          this.ast.generateClassStatements(statements),
        ],
      });
    }
  }

  generateResponses(): void {
    const responses = _.filter(
      this.openapi.response?.groupResponsesByTag,
      (item) => item.tags.length > 1,
    );

    const responseBody = _.chain(responses)
      .map(({ refName, responseObject }) => {
        const mediaTypeObjects: Array<
          OasTypes.SchemaObject | OpenAPIV3.ReferenceObject | undefined
        > = _.chain(responseObject.content)
          .values()
          .map((item) => item.schema)
          .filter(Boolean)
          .value();
        return {
          refName,
          schema: _.head(mediaTypeObjects),
        };
      })
      .value() as {
      refName: string;
      schema: OasTypes.SchemaObject | OpenAPIV3.ReferenceObject;
    }[];

    _.chain(responseBody)
      .forEach(({ refName, schema }) => {
        const schemaObject: OasTypes.SchemaObject =
          "$ref" in schema && schema.$ref
            ? (this.openapi.findSchemaDefinition(
                schema.$ref,
              ) as OasTypes.SchemaObject)
            : schema;

        this.generateResponseSchema({
          description: schemaObject.description,
          refName:
            "$ref" in schema && schema.$ref
              ? schema.$ref.replace(/.+\//, "")
              : refName,
          schema: schemaObject,
        });
      })
      .value();
  }

  generateResponseSchema({
    description,
    refName,
    schema,
  }: {
    description: string | undefined;
    refName: string;
    schema: OasTypes.SchemaObject;
  }) {
    // const isError = /^([3-5][0-9][0-9])$/.test(code);
    const property = this.schema.getPropertyStructureFromSchemaObject(schema);
    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      name: `${refName}`,
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
      properties: property?.propertiesStructure ?? [],
    };

    const filePath = path.join(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      RESPONSES_DIR,
      _.kebabCase(refName.endsWith("Vo") ? refName.slice(0, -2) : refName) +
        ".vo.ts",
    );

    const nestjsSwagger: ImportStatementsOmitKind = {
      namedImports: ["ApiProperty"],
      moduleSpecifier: "@nestjs/swagger",
    };

    const importSchemas: ImportStatementsOmitKind[] = _.chain(
      property?.namedImports,
    )
      .map((item) => {
        return {
          namedImports: [item],
          moduleSpecifier: "./" + SCHEMA_DIR + "/" + item,
        };
      })
      .value();

    if (!_.isEmpty(statements.properties)) {
      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.ast.generateImportStatements(
            this.mergeNamedImports(
              [
                nestjsSwagger,
                this.generateValidatorImports(
                  property?.validatorDecorator || [],
                ),
                ...importSchemas,
              ].filter((item) => !_.isEmpty(item.namedImports)),
            ),
          ),
          this.ast.generateClassStatements(statements),
        ],
      });
    }
  }

  generateSchemas(): void {
    //导出schemas

    _.chain(this.openapi.component.schemas)
      .forEach((schema) => {
        const schemaObject: OasTypes.SchemaObject =
          "$ref" in schema && schema.$ref
            ? (this.openapi.findSchemaDefinition(
                schema.$ref,
              ) as OasTypes.SchemaObject)
            : schema;

        this.generateSchema(schemaObject);
      })
      .value();
  }

  generateSchema(schema: OasTypes.SchemaObject): void {
    const propertyStructure =
      this.schema.getPropertyStructureFromSchemaObject(schema);
    const title = schema.title ?? "";

    const statements: Omit<ClassDeclarationStructure, "kind"> = {
      leadingTrivia: "\n",
      isExported: true,
      name: schema.title,
      decorators: [],
      docs: schema.description
        ? [
            {
              description: "\n",
              tags: [
                {
                  tagName: "description",
                  text: schema.description,
                },
              ].filter((item) => !!item.text),
            },
          ]
        : [],
      methods: [],
      properties: propertyStructure?.propertiesStructure ?? [],
    };

    const filePath = path.join(
      this.openapiToSingleConfig.output.dir,
      OUTPUT_DIR,
      RESPONSES_DIR,
      _.kebabCase(title.endsWith("Dto") ? title.slice(0, -2) : title) +
        ".dto.ts",
    );

    const nestjsSwagger: ImportStatementsOmitKind = {
      namedImports: ["ApiProperty"],
      moduleSpecifier: "@nestjs/swagger",
    };

    if (!_.isEmpty(statements.properties)) {
      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.ast.generateImportStatements([nestjsSwagger]),
          this.ast.generateClassStatements(statements),
        ],
      });
    }
  }
}
