import path from "node:path";

import { URLPath } from "@openapi-to/core/utils";

import _ from "lodash";
import { StructureKind, VariableDeclarationKind } from "ts-morph";

import type { PluginContext } from "@openapi-to/core";
import type { AST, OpenAPI } from "@openapi-to/core";
import type { OpenapiToSingleConfig } from "@openapi-to/core";
import type Oas from "oas";
import type { Operation } from "oas/operation";
import type { OpenAPIV3 } from "openapi-types";
import type {
  ImportDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
} from "ts-morph";
import type { PluginConfig } from "./types.ts";

type RequestGeneratorParams = {
  oas: Oas;
  openapi: OpenAPI;
  ast: AST;
  pluginConfig: PluginConfig;
  openapiToSingleConfig: OpenapiToSingleConfig;
};

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

export class RequestGenerator {
  private operation: Operation | undefined;
  private oas: RequestGeneratorParams["oas"];
  private readonly paramsZodSchema: string;
  private readonly openapi: RequestGeneratorParams["openapi"];
  private readonly ast: RequestGeneratorParams["ast"];
  private readonly pluginConfig: RequestGeneratorParams["pluginConfig"];
  private readonly openapiToSingleConfig: RequestGeneratorParams["openapiToSingleConfig"];

  constructor({
    oas,
    openapi,
    ast,
    pluginConfig,
    openapiToSingleConfig,
  }: RequestGeneratorParams) {
    this.oas = oas;
    this.ast = ast;
    this.pluginConfig = pluginConfig;
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.openapi = openapi;
    this.paramsZodSchema = "paramsZodSchema";
  }

  get currentTagName() {
    return _.upperFirst(
      _.camelCase(
        this.openapi &&
          this.openapi.currentTagMetadata &&
          this.openapi.currentTagMetadata.name,
      ),
    );
  }

  get className() {
    return this.currentTagName + "API";
  }

  get lowerFirstClassName() {
    return _.lowerFirst(this.className);
  }

  get namespaceTypeName(): string {
    return this.currentTagName;
  }

  get namespaceZodName(): string {
    return this.currentTagName + "Zod";
  }

  get isCreateZodDecorator(): boolean {
    return this.pluginConfig.createZodDecorator;
  }

  build(context: PluginContext): void {
    _.mapValues(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      const methodsStatements = _.map(pathGroup, ({ path, method, tag }) => {
        this.operation = this.openapi.setCurrentOperation(path, method, tag);
        return this.generatorMethod();
      });
      const filePath = path.resolve(
        context.output,
        this.lowerFirstClassName + ".ts",
      );
      return this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(),
          this.generatorClass(methodsStatements),
          ...this.generatorExport(),
        ],
      });
    });
  }

  /**
   * @example
   * ```
   * const apiName = new ApiName
   * export { apiName }
   * ```
   */
  generatorExport() {
    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: this.lowerFirstClassName,
            initializer: "new" + " " + this.className,
          },
        ],
        isExported: true,
      }),
      /*      this.ast.generateExportDeclarationStatements({
        kind: StructureKind.ExportDeclaration,
        namedExports: "apiName",
      }),*/
    ];
  }

  /**
   *
   * @example
   * ```
   * #type
   * import {} './type'
   * #zod
   * //zod decorator
   * import { paramsZodSchema, responseZodSchema, zodValidate } from '@/utils/zod'
   * // ts type
   * import type { DrmsDynamicDataType } from './drmsDynamicDataZod'
   * // zod
   * import { Zod } from './drmsDynamicDataZod'
   * ```
   */
  generateImport() {
    const zodDecorator: ImportStatementsOmitKind = {
      namedImports: ["paramsZodSchema", "responseZodSchema", "zodValidate"],
      moduleSpecifier: "@/utils/zod",
    };

    const request: ImportStatementsOmitKind = {
      namedImports: ["request"],
      moduleSpecifier: "@/api/request",
    };

    //todo model
    //requestBody response
    const typeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.namespaceTypeName],
      moduleSpecifier: `./${this.namespaceTypeName}`,
    };

    const zodModel: ImportStatementsOmitKind = {
      namedImports: [this.namespaceZodName],
      moduleSpecifier: `./${this.namespaceZodName}`,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .concat(this.isCreateZodDecorator ? [zodModel, zodDecorator] : [])
      .push(typeModel)
      .push(request)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  generatorClass(
    methodsStatements: OptionalKind<MethodDeclarationStructure>[],
  ) {
    const statements = {
      name: this.className,
      docs: [
        {
          description: "\n",
          tags: [
            {
              tagName: "tag",
              text:
                this.openapi &&
                this.openapi.currentTagMetadata &&
                this.openapi.currentTagMetadata.name,
            },
            {
              tagName: "description",
              text:
                this.openapi &&
                this.openapi.currentTagMetadata &&
                this.openapi.currentTagMetadata.description,
            },
          ],
        },
      ],
      methods: methodsStatements,
    };
    return this.ast.generateClassStatements(statements);
  }

  /**
   * @example
   * ```
   *@zodValidate
   *@responseZodSchema(ZOD.updateResponse)
   * ```
   */
  generatorMethodDecorators() {
    return [
      {
        name: "zodValidate",
      },
      {
        name: "responseZodSchema",
        arguments: [
          this.namespaceZodName + "." + this.openapi.upperFirstResponseName,
        ],
      },
    ];
  }

  /**
   * @example
   * ```
   * query: ApiType.FindAllQueryRequest
   * body: ApiType.UpdateBodyRequest
   * id: ApiType.FindByIdPathRequest['id']
   * ```
   */
  generatorMethodParameters() {
    const queryParameters = {
      name: "queryParams",
      type:
        this.namespaceTypeName + "." + this.openapi.upperFirstQueryRequestName,
      decorators: [
        {
          name: this.paramsZodSchema,
          arguments: [
            this.namespaceZodName +
              "." +
              this.openapi.upperFirstQueryRequestName,
          ],
        },
      ],
    };

    const bodyParameters = {
      name: "bodyParams",
      type:
        this.namespaceTypeName + "." + this.openapi.upperFirstBodyRequestName,
      decorators: [
        {
          name: this.paramsZodSchema,
          arguments: [
            this.namespaceZodName +
              "." +
              this.openapi.upperFirstBodyRequestName,
          ],
        },
      ],
    };

    const pathParameters = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: OpenAPIV3.ParameterObject) => {
        return {
          name: _.camelCase(item.name),
          type:
            this.namespaceTypeName +
            "." +
            this.openapi.upperFirstPathRequestName +
            `['${_.camelCase(item.name)}']`,
          decorators: [
            {
              name: this.paramsZodSchema,
              arguments: [
                this.namespaceZodName +
                  "." +
                  this.openapi.upperFirstPathRequestName +
                  `['${_.camelCase(item.name)}']`,
              ],
            },
          ],
        };
      })
      .value();

    return _.chain([] as any[])
      .push(
        this.openapi.parameter?.hasQueryParameters
          ? queryParameters
          : undefined,
      )
      .push(
        this.openapi.requestBody?.hasRequestBody ? bodyParameters : undefined,
      )
      .concat(
        this.openapi.parameter?.hasPathParameters ? pathParameters : undefined,
      )
      .filter(Boolean)
      .value();
  }

  /**
   * @example
   * ```
   * export namespace tag {
   *  export type queryRequest = object
   * }
   * ```
   */
  generateNamespaceType() {
    return {
      kind: StructureKind.Module,
      docs: [{ description: this.openapi.currentTagMetadata?.description }],
      isExported: true,
      name: this.namespaceTypeName,
      statements: [
        {
          kind: StructureKind.TypeAlias,
          isExported: true,
          name: "queryRequest",
          docs: [{ description: "queryRequest" }],
          type: "object",
        },
      ],
    };
  }

  /**
   * @example
   * ```
   * Promise<[ApiType.ErrorResponse, ApiType.FindByIdResponse]>
   * ```
   */
  generatorReturnType(): string {
    const resultType =
      this.namespaceTypeName + "." + this.openapi.upperFirstResponseName;
    return `Promise<[${this.namespaceTypeName}.${this.openapi.upperFirstRequestName}ErrorResponse,${resultType}]>`;
  }

  /**
   * @example
   * ```
   *  @summary 查询事项目录详情
   *  @description 详细描述
   * ```
   */
  generatorMethodDocs() {
    return [
      {
        description: "\n",
        tags: [
          {
            tagName: "summary",
            text: this.operation?.getSummary(),
          },
          {
            tagName: "description",
            text: this.operation?.getDescription(),
          },
        ],
      },
    ];
  }

  generatorParamsSerializer(): string {
    return `paramsSerializer(params:${this.namespaceTypeName + "." + this.openapi.queryRequestName}) {
            return qs.stringify(params)
        }`;
  }

  /**
   * @example
   * ```
   * request({
   *  method:"get",
   *  headers:{
   *    'Content-type':'application/x-www-form-urlencoded'
   *  },
   *  url:"/xxx/xx",
   *  params:query,
   *  data:body,
   * paramsSerializer(params: BusinessType.DetailByIdQueryRequest) {
   *                 return qs.stringify(params)
   *             }
   * })
   * ```
   */
  generatorMethodBody(): string {
    const url = new URLPath(<string>this.operation?.path);
    // headers: { 'Content-Type': 'multipart/form-data' },
    const header = () => {
      if (this.openapi.requestBody?.isJsonContainsDefaultCases) {
        return "";
      }
      return `headers:{
        'Content-Type':'${this.openapi.requestBody?.getContentType}'
    }`;
    };

    const requestFuncContent = _.chain([] as string[])
      .push("method:" + "'" + this.operation?.method + "'")
      .push(header())
      .push("url:" + url.requestPath)
      .push(
        this.openapi.parameter?.hasQueryParameters ? "params:queryParams" : "",
      )
      .push(this.openapi.requestBody?.hasRequestBody ? "data:bodyParams" : "")
      .push(this.openapi.response?.isDownLoad ? "responseType:'blob'" : "")
      .push(
        this.openapi.parameter?.hasQueryParametersArray
          ? this.generatorParamsSerializer()
          : "",
      )
      .filter(Boolean)
      .join(",\n")
      .value();
    return `return request({
             ${requestFuncContent}
})`;
  }

  generatorMethod(): MethodDeclarationStructure {
    const statement = {
      name: this.openapi.requestName,
      decorators: this.generatorMethodDecorators(),
      parameters: this.generatorMethodParameters(),
      returnType: this.generatorReturnType(),
      docs: this.generatorMethodDocs(),
      // scope: Scope.Public,
      statements: this.generatorMethodBody(),
    };
    return this.ast.generateMethodStatements(statement);
  }
}
