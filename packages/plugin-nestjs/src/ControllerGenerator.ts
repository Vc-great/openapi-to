import { NUMBER_ENUM } from "@openapi-to/core";
import { URLPath } from "@openapi-to/core/utils";

import _ from "lodash";
import { Scope } from "ts-morph";

import { HttpStatusObject } from "./http-status.ts";
import { NestjsGenerator } from "./NestjsGenerator.ts";

import type { PluginContext } from "@openapi-to/core";
import type { ParameterObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { ClassDeclarationStructure } from "ts-morph";
import type { ParameterDeclarationStructure } from "ts-morph";
import type { DecoratorStructure } from "ts-morph";
import type {
  ImportDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
} from "ts-morph";
import type { Config } from "./types.ts";

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

export class ControllerGenerator extends NestjsGenerator {
  private nestjsCommonImports: Set<string> = new Set<string>();
  private swaggerImports: Set<string> = new Set<string>();

  constructor(config: Config) {
    super(config);
  }

  get getResponseStatusCodes() {
    return this.openapi.response?.getResponseStatusCodes;
  }

  get hasAuth() {
    return _.has(this.oas.api, "components.securitySchemes.http");
  }

  get isArrayOfRequestBody(): boolean {
    const requestBodyObject = this.openapi.requestBody?.requestBodyObject;
    return _.get(requestBodyObject, "schemaObject.type") === "array";
  }

  get isArrayORBaseType() {
    const requestBodyObject = this.openapi.requestBody?.requestBodyObject;
    const requestBodyType =
      requestBodyObject?.refName ||
      _.get(requestBodyObject, "schemaObject.$ref") ||
      _.get(requestBodyObject, "schemaObject.type");

    return (
      this.isArrayOfRequestBody ||
      ["string", "number", "boolean"].includes(
        _.isArray(requestBodyType) ? "" : (requestBodyType ?? ""),
      )
    );
  }

  get hasPermissions(): boolean {
    return !!this.oas.getExtension("x-permissions", this.operation);
  }

  build(context: PluginContext): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      const methodsStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);

          this.setNestjsCommonImports();
          this.setSwaggerImports();
          return this.generatorMethod();
        })
        .value();

      this.ast.createSourceFile(this.controllerFilePath, {
        statements: [
          ...this.generateImport(),
          this.generatorClass(methodsStatements),
        ],
      });
    });
  }

  getParseArrayPipe(): string | undefined {
    const mediaTypeObject =
      this.openapi.requestBody?.getRequestBodySchemaOfApplicationJson;

    const type = _.get(mediaTypeObject, "schema.items.type", "");
    //todo ("array" | NonArraySchemaObjectType)[]
    if (_.isArray(type)) {
      return undefined;
    }

    const isBaseTypeOfBodyArrayItems = !["object", "array"].includes(type);

    const baseType = isBaseTypeOfBodyArrayItems
      ? NUMBER_ENUM.includes(type)
        ? "Number"
        : type
      : type;

    return baseType
      ? `new ParseArrayPipe({ items: ${_.upperFirst(baseType)} })`
      : undefined;
  }

  setNestjsCommonImports(): void {
    this.nestjsCommonImports.add(_.upperFirst(this.operation?.method));

    const hasPathNumber = _.some(
      this.openapi.parameter?.parametersOfPath,
      (item) => NUMBER_ENUM.includes(_.get(item, "schema.type", "")),
    );

    _.chain([] as string[])
      .concat(this.openapi.parameter?.hasQueryParameters ? "Query" : [])
      .concat(this.openapi.parameter?.hasPathParameters ? "Param" : [])
      .concat(this.openapi.requestBody?.hasRequestBody ? "Body" : [])
      .concat(hasPathNumber ? ["Param", "ParseIntPipe"] : [])
      .concat(this.getParseArrayPipe() ? ["ParseArrayPipe"] : [])
      .forEach((x) => this.nestjsCommonImports.add(x))
      .value();
  }

  setSwaggerImports(): void {
    _.chain([] as string[])
      .concat(this.openapi.parameter?.hasPathParameters ? "ApiParam" : [])
      .concat(this.isArrayORBaseType ? "ApiBody" : [])
      .concat(this.hasAuth ? "ApiBearerAuth" : [])
      .forEach((x) => {
        this.swaggerImports.add(x);
      })
      .value();
  }

  generateImport(): Array<ImportDeclarationStructure> {
    const nestjsCommon: ImportStatementsOmitKind = {
      namedImports: [
        "Controller",
        "HttpStatus",
        "HttpCode",
        ...this.nestjsCommonImports,
      ],
      moduleSpecifier: "@nestjs/common",
    };

    const nestjsSwagger: ImportStatementsOmitKind = {
      namedImports: ["ApiOperation", "ApiResponse", ...this.swaggerImports],
      moduleSpecifier: "@nestjs/swagger",
    };
    //todo 筛选
    const auth: ImportStatementsOmitKind = {
      namedImports: ["Permissions"], //"Public"
      moduleSpecifier: "@/common/decorators/auth.decorator",
    };

    const ApiTag: ImportStatementsOmitKind = {
      namedImports: ["ApiTag"],
      moduleSpecifier: "@/common/swagger",
    };

    const service: ImportStatementsOmitKind = {
      namedImports: [this.serviceClassName],
      moduleSpecifier: this.serviceModuleSpecifier,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .push(nestjsCommon)
      .push(nestjsSwagger)
      .push(auth)
      .push(ApiTag)
      .push(service)
      .concat(this.domainImportStatements)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  generatorClass(
    methodsStatements: OptionalKind<MethodDeclarationStructure>[],
  ): ClassDeclarationStructure {
    const statements = {
      name: this.controllerClassName,
      decorators: this.generatorClassDecorators(),
      isExported: true,
      docs: [],
      methods: methodsStatements,
      ctors: [
        {
          parameters: [
            {
              isReadonly: true,
              scope: Scope.Private,
              name: _.lowerFirst(this.serviceClassName),
              type: this.serviceClassName,
            },
          ],
        },
      ],
    };
    return this.ast.generateClassStatements(statements);
  }

  generatorClassDecorators(): OptionalKind<DecoratorStructure>[] {
    const apiTags = {
      name: "ApiTag",
      arguments: [
        `{
          name: '${this.openapi.currentTagName}',
          description: '${this.openapi.currentTagMetadata?.description}',
        }`,
      ],
    };

    const controller = {
      name: "Controller",
      arguments: [`'${this.openapi.currentTagName}'`],
    };

    const apiBearerAuth = {
      name: "ApiBearerAuth",
      arguments: [],
    };

    return _.chain([] as OptionalKind<DecoratorStructure>[])
      .push(apiTags)
      .push(controller)
      .concat(this.hasAuth ? apiBearerAuth : [])
      .filter(Boolean)
      .value();
  }

  generatorMethodDecorators(): OptionalKind<DecoratorStructure>[] {
    const httpCode: string = _.get(
      HttpStatusObject,
      this.openapi.response?.successCode || "200",
    );

    const regex = `/${this.openapi.currentTagName}`;

    const methodPath = new URLPath(
      this.openapi.operation?.path.replace(regex, "") || "",
    ).toURLPath;

    const methodDecorator = {
      name:
        _.upperFirst(this.openapi.operation?.method) +
        (methodPath ? "('" : "(") +
        methodPath +
        (methodPath ? "')" : ")"),
    };

    const httpCodeDecorator = {
      name: "HttpCode",
      arguments: [`HttpStatus.${httpCode}`],
    };

    const ApiOperationDecorator: OptionalKind<DecoratorStructure> = {
      name: "ApiOperation",
      arguments: [
        "{" +
          _.chain([] as string[])
            .concat(
              this.operation?.getSummary()
                ? `summary:'${this.operation?.getSummary()}'`
                : [],
            )
            .concat(
              this.operation?.getDescription()
                ? `description:'${this.operation?.getDescription()}'`
                : [],
            )
            .join()
            .value() +
          "}",
      ],
    };

    const responseType = this.openapi.response?.successResponse?.refName;

    const successResponseJSONSchema = this.openapi.response?.successResponse;

    const ApiResponseDecorator: OptionalKind<DecoratorStructure> = {
      name: "ApiResponse",
      arguments: [
        "{" +
          _.chain([] as string[])
            .push(`status: HttpStatus.${httpCode}`)
            .concat(
              successResponseJSONSchema?.description
                ? `description:${JSON.stringify(successResponseJSONSchema?.description)}`
                : [],
            )
            .concat(responseType ? responseType : [])
            .concat(
              successResponseJSONSchema?.type === "array"
                ? ` isArray:true`
                : [],
            )
            .filter(Boolean)
            .join(",")
            .value() +
          "}",
      ],
    };

    const requestBodyObject = this.openapi.requestBody?.requestBodyObject;

    const requestBodyType =
      requestBodyObject?.refName ||
      _.get(requestBodyObject, "schemaObject.$ref") ||
      _.get(requestBodyObject, "schemaObject.type");

    const apiBodyDecorator: OptionalKind<DecoratorStructure> = {
      name: "ApiBody",
      arguments: [
        JSON.stringify({
          required: _.get(
            this.operation,
            "schema.requestBody.required",
            undefined,
          ),
          type: requestBodyType || "any",
          isArray: this.isArrayOfRequestBody || undefined,
          description: requestBodyObject?.description,
          examples: requestBodyObject?.examples,
          example: requestBodyObject?.example,
        }),
      ],
    };

    const apiParam: OptionalKind<DecoratorStructure>[] = _.chain(
      this.openapi.parameter?.parameters,
    )
      .filter(["in", "path"])
      .map((item) => {
        return {
          name: "ApiParam",
          arguments: [
            `{
              name:"${_.camelCase(item.name)}",
              description:"${item.description}"
            }`,
          ],
        };
      })
      .value();

    const permissions = this.oas.getExtension(
      "x-permissions",
      this.operation,
    ) as string[] | undefined;

    const PermissionsDecorator: OptionalKind<DecoratorStructure> = {
      name: "Permissions",
      arguments: permissions
        ? permissions.map((item) => JSON.stringify(item))
        : [],
    };

    return _.chain([] as OptionalKind<DecoratorStructure>[])
      .concat(ApiOperationDecorator)
      .concat(ApiResponseDecorator)
      .concat(apiParam)
      .concat(this.isArrayORBaseType ? apiBodyDecorator : [])
      .concat(methodDecorator)
      .concat(this.hasPermissions ? PermissionsDecorator : [])
      .concat(httpCodeDecorator)
      .filter(Boolean)
      .value();
  }

  /**
   * @example
   * ```
   * @Query() query: QueryUserDto
   * @Param('id', ParseIntPipe)id: number
   * @Body() data: UpdateUserDto
   * ```
   */
  generatorMethodParameters(): OptionalKind<ParameterDeclarationStructure>[] {
    const queryParameters = {
      ...this.queryParameters,
      decorators: [
        {
          name: "Query",
          arguments: [],
        },
      ],
    };

    const bodyParameters = {
      ...this.bodyParameters,
      decorators: [
        {
          name: "Body",
          arguments: [this.getParseArrayPipe()].filter(Boolean),
        },
      ],
    };

    const pathParameters = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: OpenAPIV3.ParameterObject) => {
        //todo other type
        const pathType =
          (item.schema && "type" in item.schema && item.schema.type) ??
          "string";
        return {
          name: _.camelCase(item.name),
          type: NUMBER_ENUM.includes(pathType || "") ? "number" : pathType,
          decorators: [
            {
              name: "Param",
              arguments: NUMBER_ENUM.includes(pathType || "")
                ? [JSON.stringify(_.camelCase(item.name)), "ParseIntPipe"]
                : [],
            },
          ],
        };
      })
      .value() as unknown as OptionalKind<ParameterDeclarationStructure>[];

    return _.chain([] as OptionalKind<ParameterDeclarationStructure>[])
      .concat(this.openapi.parameter?.hasPathParameters ? pathParameters : [])
      .concat(this.openapi.parameter?.hasQueryParameters ? queryParameters : [])
      .concat(this.openapi.requestBody?.hasRequestBody ? bodyParameters : [])
      .filter(Boolean)
      .value();
  }

  generatorMethodBody(): string {
    const pathParameters = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: ParameterObject) => _.camelCase(item.name))
      .value() as unknown as string[];

    const args = _.chain([] as string[])
      .concat(this.openapi.parameter?.hasPathParameters ? pathParameters : [])
      .concat(this.openapi.parameter?.hasQueryParameters ? "query" : [])
      .concat(this.openapi.requestBody?.hasRequestBody ? "data" : [])
      .join()
      .value();

    return `return await this.${_.lowerFirst(this.serviceClassName)}.${this.methodName}(${args})`;
  }

  generatorMethod(): MethodDeclarationStructure {
    const statement = {
      name: this.methodName,
      decorators: this.generatorMethodDecorators(),
      parameters: this.generatorMethodParameters(),
      returnType: this.generatorReturnType(),
      docs: [],
      statements: this.generatorMethodBody(),
      isAsync: true,
    };

    return this.ast.generateMethodStatements(statement);
  }
}
