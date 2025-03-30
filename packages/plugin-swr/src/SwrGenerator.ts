import path from "node:path";

import { pluginEnum } from "@openapi-to/core";
import { URLPath } from "@openapi-to/core/utils";
import { REQUEST_SUFFIX } from "@openapi-to/plugin-ts-request/src/constants.ts";
import { TYPE_SUFFIX } from "@openapi-to/plugin-ts-type/src/constants.ts";
import { ZOD_SUFFIX } from "@openapi-to/plugin-zod/src/constants.ts";

import _ from "lodash";
import { StructureKind, VariableDeclarationKind } from "ts-morph";

import { SWR_SUFFIX } from "./constants.ts";

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

export class SwrGenerator {
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
    return _.lowerFirst(`${this.openapi.currentTagNameOfPinYin}.${SWR_SUFFIX}`);
  }
  get lowerFirsSWRKeyName(): string {
    return _.lowerFirst(
      `${this.openapi.currentTagNameOfPinYin + _.toUpper(SWR_SUFFIX)}Key`,
    );
  }

  get lowerFirstSWRName(): string {
    return _.lowerFirst(
      this.openapi.currentTagNameOfPinYin + _.toUpper(SWR_SUFFIX),
    );
  }

  get swrNamespaceTypeName(): string {
    return _.upperFirst(`${this.openapi.currentTagNameOfPinYin}Key`);
  }

  get upperFirstNamespaceTypeName(): string {
    return this.openapiToSingleConfig.pluginNames.includes(pluginEnum.Zod)
      ? _.upperFirst(this.openapi.currentTagNameOfPinYin)
      : _.upperFirst(this.openapi.currentTagNameOfPinYin);
  }

  get lowerFirstNamespaceTypeName(): string {
    return this.openapiToSingleConfig.pluginNames.includes(pluginEnum.Zod)
      ? `${_.lowerFirst(this.openapi.currentTagNameOfPinYin)}.${ZOD_SUFFIX}`
      : `${_.lowerFirst(this.openapi.currentTagNameOfPinYin)}.${TYPE_SUFFIX}`;
  }

  get responseDataType(): string {
    return (
      `${this.upperFirstNamespaceTypeName}.${this.openapi.upperFirstResponseName}`
    );
  }

  get errorResponseTypeName() {
    return (
      `${this.upperFirstNamespaceTypeName}.${this.openapi.errorResponseTypeName}`
    );
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
    return (
      `${this.upperFirstNamespaceTypeName}.${this.openapi.upperFirstBodyDataName}`
    );
  }

  get keyName(): string {
    if (this.operation?.method === "get") {
      return `${this.openapi.requestName}QueryKey`;
    }
      return `${this.openapi.requestName}MutationKey`;
  }
  get upperFirstKeyName(): string {
    return _.upperFirst(this.keyName);
  }
  //
  get upperFirstQueryKeyNameOfNameSpace(): string {
    return `${this.swrNamespaceTypeName}.${_.upperFirst(this.keyName)}`;
  }

  //upperFirstQueryKeyNameOfNameSpace

  get serviceName(): string {
    return (
      `${this.openapi.currentTagNameOfPinYin}${_.upperFirst(REQUEST_SUFFIX)}`
    );
  }

  get serviceFileName(): string {
    return `${this.openapi.currentTagNameOfPinYin}.${REQUEST_SUFFIX}`;
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
        `${this.lowerFirstFileName}.ts`,
      );

      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(),
          ...swrKey,
          this.generatorExportType(swrKeyType),
          ...methodsStatements,
          ...this.generatorSWRKeyExport(swrKey),
          ...this.generatorSWRExport(methodsStatements),
        ],
      });
    });
  }

  generatorSWRExport(
    methodsStatements: FunctionDeclarationStructure[],
  ): Array<VariableStatementStructure> {
    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: this.lowerFirstSWRName,
            initializer: `{
            ${methodsStatements
              .map((item) => item.name)
              .filter(Boolean)
              .join()}
            }`,
          },
        ],
        isExported: true,
      }),
    ];
  }

  generatorSWRKeyExport(
    swrKey: VariableStatementStructure[],
  ): Array<VariableStatementStructure> {
    return [
      this.ast.generateVariableStatements({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: this.lowerFirsSWRKeyName,
            initializer: `{
            ${swrKey
              .map((item) => item.declarations[0]?.name)
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
      name: this.swrNamespaceTypeName,
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
   * import type { DrmsDynamicDataType } from './drmsDynamicDataZod'
   * import useSWRMutation from "swr/mutation";
   * import useSWR from "swr";
   *
   * ```
   */
  generateImport(): Array<ImportDeclarationStructure> {
    const API: ImportStatementsOmitKind = {
      namedImports: [this.serviceName],
      moduleSpecifier: `./${this.serviceFileName}`,
    };

    const typeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.upperFirstNamespaceTypeName],
      moduleSpecifier: `./${this.lowerFirstNamespaceTypeName}`,
    };

    const mutationType: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: ["SWRMutationConfiguration"],
      moduleSpecifier: 'swr/mutation',
    };

    const useSWRType: ImportStatementsOmitKind = {
      defaultImport: "useSWR",
      moduleSpecifier: 'swr',
    };

    const useSWRMutationType: ImportStatementsOmitKind = {
      defaultImport: "useSWRMutation",
      moduleSpecifier: 'swr/mutation',
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .concat([API])
      .concat([typeModel])
      .concat(this.methodSet.has("get") ? [useSWRType] : [])
      .concat(
        [...this.methodSet].some((method) => method !== "get")
          ? [useSWRMutationType, mutationType]
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
        const questionToken = x.name && x.hasQuestionToken ? "?" : "";
        return (
          `${x.name + questionToken}:${_.isString(x.type) ? x.type : ""}`
        );
      })
      .value();

    const queryKey = this.openapi.parameter?.hasQueryParameters
      ? '...(params ? [params] : [])'
      : "";

    const keys = _.chain([] as string[])
      .concat(queryKey)
      .filter(Boolean)
      .join()
      .value();

    const url = new URLPath(<string>this.operation?.path);

    const parameterName = _.map(
      this.openapi.parameter?.parameters,
      (x) => x.name,
    );
    const hasPage = this.pluginConfig?.infiniteKey?.every((key) =>
      parameterName.includes(key),
    );

    return {
      leadingTrivia: "\n",
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: this.keyName,
          initializer: hasPage
            ? `(${funcParams.join()}, shouldFetch: boolean) =>
    (pageIndex: number, previousPageData: ${this.responseDataType}) => {
        if (!shouldFetch) {
            return null
        }
        if (previousPageData && !previousPageData.length) return null

        return {
            ...params
        } as const
    }`
            : `(${funcParams.join()}) => [{url:${url.requestPath},method:'${this.operation?.method}'}${keys ? `,${keys}` : ""}] as const`,

          //   docs: [{ description: "" }],
        },
      ],
      isExported: false,
    };
  }

  // type FindByThemeNameQueryKey = ReturnType<typeof getFindByThemeNameQueryKey>
  generatorSWRKeyType(): TypeAliasDeclarationStructure {
    return {
      kind: StructureKind.TypeAlias,
      isExported: false,
      name: this.upperFirstKeyName,
      // docs:[{ description: "" }],
      type: `ReturnType<typeof ${this.keyName}>`,
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
      hasQuestionToken: this.openapi.parameter?.isQueryOptional,
      type:
        `${this.upperFirstNamespaceTypeName}.${this.openapi.upperFirstQueryRequestName}`,
      decorators: [],
    };

    const pathParameters = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: OpenAPIV3.ParameterObject) => {
        return {
          name: _.camelCase(item.name),
          type:
            `${this.upperFirstNamespaceTypeName}.${this.openapi.upperFirstPathRequestName}['${_.camelCase(item.name)}']`,
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
      ? 'const { swr: queryOptions, shouldFetch = true } = options ?? {}'
      : 'const { swr: mutationOptions,shouldFetch =true} = options ?? {}';

    const queryKey = isGetMethod
      ? `const queryKey = ${this.keyName}(${queryKeyParams})` //pathParams
      : `const mutationKey = ${this.keyName}(${queryKeyParams})`;

    //SWRMutationConfiguration<UserType.SetPasswordPostResponse, unknown, any, UserType.SetPasswordPostRequest>
    const useSWRMutation = `useSWRMutation<${this.responseDataType},  ${this.errorResponseTypeName}, ${this.upperFirstQueryKeyNameOfNameSpace} | null${this.requestDataType ? `,${this.requestDataType}` : ",never"}>(shouldFetch ? mutationKey : null, async (_url,{ arg: data }) => {
        return ${this.serviceName}.${this.openapi.requestName}(${_.chain(
          [] as any,
        )
          .filter(Boolean)
          .concat(this.requestDataType ? ["data"] : [])
          .concat([queryKeyParams])
          .join()
          .value()});
    }, mutationOptions);`;

    const useSWR = `useSWR<${this.responseDataType}, ${this.errorResponseTypeName}, ${this.upperFirstQueryKeyNameOfNameSpace} | null>(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async () => {
                return ${this.openapi.currentTagNameOfPinYin}Service.${this.openapi.requestName}(${queryKeyParams});
        }
    })`;

    return `
            ${optionsParams}
             ${queryKey}
             
          return   ${isGetMethod ? useSWR : useSWRMutation}`;
  }

  generateSWROption() {
    if (this.operation?.method === "get") {
      return {
        name: "options",
        hasQuestionToken: true,
        type: `{
    swr?: Parameters<typeof useSWR<${this.responseDataType}, ${this.upperFirstQueryKeyNameOfNameSpace} | null, any>>[2]
    shouldFetch?: boolean
    }`,
      };
    }

    return {
      name: "options",
      hasQuestionToken: true,
      type: `{
        swr?: SWRMutationConfiguration<${this.responseDataType},  ${this.errorResponseTypeName}, ${this.upperFirstQueryKeyNameOfNameSpace} | null${this.requestDataType ? `,${this.requestDataType}` : ",never"}>;
        shouldFetch?: boolean;
        }`,
    };
  }

  generatorMethodsStatements(): FunctionDeclarationStructure {
    const statement = {
      isAsync: false,
      name: `use${this.openapi.upperFirstRequestName}`,
      decorators: [],
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
