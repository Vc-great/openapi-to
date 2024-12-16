import path from "node:path";

import { URLPath } from "@openapi-to/core/utils";

import _ from "lodash";
import { StructureKind, VariableDeclarationKind } from "ts-morph";

import type { PluginContext } from "@openapi-to/core";
import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type {
  ModuleDeclarationStructure,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { FunctionDeclarationStructure } from "ts-morph";
import type {
  ImportDeclarationStructure,
  JSDocStructure,
  OptionalKind,
  ParameterDeclarationStructure,
  VariableStatementStructure,
} from "ts-morph";
import type { Config, PluginConfig } from "./types.ts";

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

export class Generator {
  private operation: Operation | undefined;
  private oas: Config["oas"];
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig?: PluginConfig;
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private methodSet: Set<string> = new Set();
  constructor({
    oas,
    openapi,
    ast,
    pluginConfig,
    openapiToSingleConfig,
  }: Config) {
    this.oas = oas;
    this.ast = ast;
    this.pluginConfig = pluginConfig;
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.openapi = openapi;
  }

  get lowerFirstFileName(): string {
    return _.lowerFirst(this.openapi.currentTagName + "Query");
  }

  get namespaceName(): string {
    return _.upperFirst(this.openapi.currentTagName + "Query");
  }

  get isGetMethod(): boolean {
    return this.operation?.method === "get";
  }

  get methodOperationId(): string {
    return this.operation?.getOperationId() || "";
  }

  get namespaceTypeName(): string {
    return _.upperFirst(this.openapi.currentTagName);
  }

  get responseDataType(): string {
    return this.namespaceTypeName + "." + this.openapi.upperFirstResponseName;
  }

  get errorResponseTypeName() {
    return this.namespaceTypeName + "." + this.openapi.errorResponseTypeName;
  }

  get requestDataType(): string | undefined {
    const _bodySchema = this.openapi.requestBody?.getRequestBodySchema();
    if (_bodySchema === undefined || _.isBoolean(_bodySchema)) {
      return undefined;
    }
    let schema: SchemaObject | null = null;
    if ("schema" in _bodySchema) {
      schema = _bodySchema.schema || (null as SchemaObject | null);
    }

    if (_.isArray(_bodySchema)) {
      schema = _.get(_bodySchema, "[1].schema", null) as SchemaObject | null;
    }

    if (schema === null) {
      return undefined;
    }
    return this.namespaceTypeName + "." + this.openapi.upperFirstBodyDataName;
  }

  get queryKeyName(): string {
    if (this.operation?.method === "get") {
      return `${this.openapi.requestName}QueryKey`;
    } else {
      return `${this.openapi.requestName}MutationKey`;
    }
  }
  get upperFirstQueryKeyName(): string {
    return _.upperFirst(this.queryKeyName);
  }

  get namespaceZodName(): string {
    return this.openapi.currentTagName + "Zod";
  }

  get APIName(): string {
    return `${this.openapi.currentTagName}API`;
  }

  build(context: PluginContext): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, _tag) => {
      const { methodsStatements, swrKey, swrKeyType } = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);

          this.methodSet.add(this.operation.method);

          return {
            sort: Number.MAX_SAFE_INTEGER,
            methodsStatements: this.generatorMethodsStatements(),
            swrKey: this.generatorSWRKey(),
            swrKeyType: this.generatorSWRKeyType(),
          };
        })
        .sort((a, b) => a.sort - b.sort)
        .reduce(
          (result, item) => {
            return {
              methodsStatements: [
                ...result.methodsStatements,
                item.methodsStatements,
              ],
              swrKey: [...result.swrKey, item.swrKey],
              swrKeyType: [...result.swrKeyType, item.swrKeyType],
            };
          },
          {
            methodsStatements: [],
            swrKeyType: [],
            swrKey: [],
          } as {
            methodsStatements: Array<FunctionDeclarationStructure>;
            swrKey: Array<VariableStatementStructure>;
            swrKeyType: Array<TypeAliasDeclarationStructure>;
          },
        )
        .value();

      const filePath = path.resolve(
        this.openapiToSingleConfig.output.dir,
        this.lowerFirstFileName + ".ts",
      );

      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(),
          ...swrKey,
          ...swrKeyType,
          ...methodsStatements,
          ...this.generatorExport(methodsStatements, swrKey),
          this.generatorExportType(swrKeyType),
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
  generatorExport(
    methodsStatements: FunctionDeclarationStructure[],
    swrKey: VariableStatementStructure[],
  ): Array<VariableStatementStructure> {
    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: this.lowerFirstFileName,
            initializer: `{
            ${[
              ...swrKey.map((item) => item.declarations[0]?.name),
              methodsStatements.map((item) => item.name),
            ]
              .filter(Boolean)
              .join()}
            }`,
          },
        ],
        isExported: true,
      }),
    ];
  }
  generatorExportType(
    swrKeyType: TypeAliasDeclarationStructure[],
  ): ModuleDeclarationStructure {
    return this.ast.generateModuleStatements({
      docs: [],
      isExported: true,
      name: this.namespaceName,
      statements: swrKeyType.map((item) => {
        return {
          ...item,
          isExported: true,
        };
      }),
    });
  }

  /**
   *
   * @example
   * ```
   * // ts type
   * import type { RequestConfig } from "@kubb/plugin-client/client";
   * import type { MutationObserverOptions } from "@tanstack/vue-query";
   * import type { MaybeRef } from "vue";
   * import { useMutation } from "@tanstack/vue-query";
   *
   * ```
   */
  generateImport(): Array<ImportDeclarationStructure> {
    const API: ImportStatementsOmitKind = {
      namedImports: [this.APIName],
      moduleSpecifier: `./${this.APIName}`,
    };

    const typeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.namespaceTypeName],
      moduleSpecifier: `./${this.pluginConfig?.typeDeclarationForm === "zod" ? this.openapi.currentTagName + "Zod" : _.upperFirst(this.openapi.currentTagName)}`,
    };

    const mutation: ImportStatementsOmitKind = {
      isTypeOnly: false,
      namedImports: ["useMutation"],
      moduleSpecifier: `@tanstack/vue-query`,
    };

    const useSWRType: ImportStatementsOmitKind = {
      namedImports: ["queryOptions, useQuery"],
      moduleSpecifier: `@tanstack/vue-query`,
    };

    const vueType: ImportStatementsOmitKind = {
      namedImports: ["MaybeRef"],
      moduleSpecifier: `vue`,
    };

    const useSWRMutationType: ImportStatementsOmitKind = {
      namedImports: [
        "QueryKey",
        "QueryObserverOptions",
        "UseQueryReturnType",
        "MutationObserverOptions",
      ],
      moduleSpecifier: `@tanstack/vue-query`,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .concat([API])
      .concat([typeModel])
      //todo 有params才进行concat
      .concat([vueType])
      .concat(this.methodSet.has("get") ? [useSWRType] : [])
      .concat(
        [...this.methodSet].some((method) => method !== "get")
          ? [useSWRMutationType, mutation]
          : [],
      )
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  generatorSWRKey(): VariableStatementStructure {
    //path
    const pathParams = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((x) => _.camelCase(x.name))
      .value();

    const funcParams = _.chain(this.generatorMethodParameters())
      .filter((x) => x.name !== "data")
      .map((x) => {
        return {
          ...x,
          name: x.name === "params" ? "params?" : x.name,
        };
      })
      .map((x) => {
        return x.name + ":" + (_.isString(x.type) ? x.type : "");
      })
      .value();

    const queryKey = this.openapi.parameter?.hasQueryParameters
      ? "...(params ? [params] : [])"
      : "";

    const keys = _.chain([] as string[])
      .concat(queryKey)
      .filter(Boolean)
      .join()
      .value();

    const url = new URLPath(<string>this.operation?.path);

    return {
      leadingTrivia: "\n",
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: this.queryKeyName,
          initializer: `(${funcParams.join()}) => [{url:${url.requestPath},method:'${this.operation?.method}'}${keys ? "," + keys : ""}] as const`,

          //   docs: [{ description: "" }],
        },
      ],
      isExported: true,
    };
  }

  // type FindByThemeNameQueryKey = ReturnType<typeof getFindByThemeNameQueryKey>
  generatorSWRKeyType(): TypeAliasDeclarationStructure {
    return {
      kind: StructureKind.TypeAlias,
      isExported: false,
      name: this.upperFirstQueryKeyName,
      // docs:[{ description: "" }],
      type: `ReturnType<typeof ${this.queryKeyName}>`,
    };
  }

  /**
   * @example
   * ```
   * query: ApiType.FindAllQueryRequest
   * body: ApiType.UpdateBodyRequest
   * id: ApiType.FindByIdPathRequest['id']
   * ```
   */
  generatorMethodParameters(): OptionalKind<ParameterDeclarationStructure>[] {
    const queryParameters = {
      name: "params",
      hasQuestionToken: true,
      type: `MaybeRef<${this.namespaceTypeName}.${this.openapi.upperFirstQueryRequestName}>`,
      decorators: [],
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
          decorators: [],
        };
      })
      .value();

    return (
      _.chain([] as any[])
        .concat(
          this.openapi.parameter?.hasPathParameters
            ? pathParameters
            : undefined,
        )
        .push(
          this.openapi.parameter?.hasQueryParameters
            ? queryParameters
            : undefined,
        )
        /*      .push(
        this.openapi.requestBody?.hasRequestBody
          ? bodyDataParameters
          : undefined,
      )*/
        .filter(Boolean)
        .value()
    );
  }

  /**
   * @example
   * ```
   *  @summary 查询事项目录详情
   *  @description 详细描述
   * ```
   */
  generatorMethodDocs(): OptionalKind<JSDocStructure>[] {
    return [
      {
        description: "",
        tags: [
          {
            tagName: "summary",
            text: this.operation?.getSummary(),
          },
          {
            tagName: "description",
            text: this.operation?.getDescription(),
          },
        ].filter((x) => x.text),
      },
    ];
  }

  generatorMethodBody(): string {
    const isGetMethod = this.operation?.method.toUpperCase() === "GET";

    const hasQueryParams = !_.chain(this.openapi.parameter?.parameters)
      .filter(["in", "query"])
      .map((x) => x.name)
      .isEmpty()
      .value();

    const pathParams = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((x) => _.camelCase(x.name))
      .value();

    const queryKeyParams = _.chain([
      ...pathParams,
      hasQueryParams ? "params" : undefined,
    ])
      .filter(Boolean)
      .join()
      .value();

    const optionsParams = isGetMethod
      ? `const { query: queryOption } = options ?? {}`
      : `const { mutation: mutationOptions } = options ?? {}`;

    const queryKey = isGetMethod
      ? `const queryKey = queryOption?.queryKey ?? ${this.queryKeyName}(${queryKeyParams})` //pathParams
      : `const mutationKey = mutationOptions?.mutationKey ?? ${this.queryKeyName}(${queryKeyParams})`;

    const useMutation = `useMutation<${this.responseDataType},${this.errorResponseTypeName}${this.requestDataType ? `,{data:${this.requestDataType}}` : ""}>({
        mutationFn:async (${this.requestDataType ? "{ data }" : ""}) => {
            return ${this.APIName}.${this.openapi.requestName}(${_.chain([
              queryKeyParams,
            ])
              .filter(Boolean)
              .concat(this.requestDataType ? ["data"] : [])
              .join()
              .value()});
        },
        mutationKey,
        ...mutationOptions
})`;

    const query = `useQuery({
        ...(queryOptions({
             queryKey: queryKey as QueryKey,
            queryFn: async ({signal}) => {
                return ${this.APIName}.${this.openapi.requestName}(${queryKeyParams});
            }
        }) as QueryObserverOptions),
        ...(queryOption as unknown as Omit<QueryObserverOptions, 'queryKey'>)
    }) as UseQueryReturnType<TData, ${this.errorResponseTypeName}>
    `;

    return `
            ${optionsParams}
             ${queryKey}
             
          return   ${isGetMethod ? query : useMutation}`;
  }

  generateSWROption() {
    if (this.operation?.method === "get") {
      return {
        name: "options",
        hasQuestionToken: true,
        type: `{
    query?: Partial<QueryObserverOptions<${this.responseDataType}, ${this.errorResponseTypeName},TData, TQueryData, TQueryKey>>
    }`,
      };
    }
    //
    return {
      name: "options",
      hasQuestionToken: true,
      type: `{
        mutation?: MutationObserverOptions<${this.responseDataType},  ${this.errorResponseTypeName} ${
          this.requestDataType
            ? `,{data:MaybeRef<${this.requestDataType}>}`
            : ""
        }>;
        }`,
    };
  }

  generateTypeParameters() {
    if (!this.isGetMethod) {
      return [];
    }
    //query 查询的
    return [
      {
        name: "TData",
        default: this.responseDataType,
      },
      {
        name: "TQueryData",
        default: this.responseDataType,
      },
      {
        name: "TQueryKey",
        default: this.upperFirstQueryKeyName,
        constraint: "QueryKey", // 可以设置泛型约束
      },
    ];
  }

  generatorMethodsStatements(): FunctionDeclarationStructure {
    const statement = {
      isAsync: false,
      name: "use" + this.openapi.upperFirstRequestName,
      decorators: [],
      typeParameters: this.generateTypeParameters(),
      parameters: [
        ...this.generatorMethodParameters(),
        this.generateSWROption(),
      ],
      returnType: "",
      docs: this.generatorMethodDocs(),
      statements: this.generatorMethodBody(),
    };

    return this.ast.generateFunctionStatements(statement);
  }
}
