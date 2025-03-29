import path from "node:path";

import { pluginEnum } from "@openapi-to/core";
import { URLPath, UUID_TAG_NAME } from "@openapi-to/core/utils";
import { TYPE_SUFFIX } from "@openapi-to/plugin-ts-type/src/constants.ts";
import { ZOD_SUFFIX } from "@openapi-to/plugin-zod/src/constants.ts";

import _ from "lodash";
import { VariableDeclarationKind } from "ts-morph";

import { REQUEST_SUFFIX } from "./constants.ts";
import { RequestOldNode } from "./RequestOldNode.ts";
import { RequestTypeEnum } from "./types.ts";

import type { PluginContext } from "@openapi-to/core";
import type { Operation } from "oas/operation";
import type { OpenAPIV3 } from "openapi-types";
import type {
  ClassDeclarationStructure,
  DecoratorStructure,
  ImportDeclarationStructure,
  JSDocStructure,
  MethodDeclarationStructure,
  OptionalKind,
  ParameterDeclarationStructure,
  VariableStatementStructure,
} from "ts-morph";
import type { Required } from "utility-types";
import type { PluginConfig } from "./types.ts";
import type { Config } from "./types.ts";
type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

export class RequestGenerator {
  private operation: Operation | undefined;
  private oas: Config["oas"];
  private readonly paramsZodSchema: string = "paramsZodSchema";
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Required<
    PluginConfig,
    "createZodDecorator" | "requestType" | "compare"
  >;
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private oldNode: RequestOldNode;

  constructor({
    oas,
    openapi,
    ast,
    pluginConfig,
    openapiToSingleConfig,
  }: Config) {
    this.oas = oas;
    this.ast = ast;
    this.pluginConfig = _.merge(
      {
        createZodDecorator: false,
        requestType: RequestTypeEnum.AXIOS,
        compare: false,
      },
      pluginConfig,
    );
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.openapi = openapi;

    this.oldNode = new RequestOldNode(pluginConfig, openapiToSingleConfig);
  }

  get compare(): boolean {
    return this.pluginConfig?.compare || false;
  }

  get classOperationIdPrefix(): string {
    return "API-";
  }
  get classOperationId(): string {
    return this.classOperationIdPrefix + this.openapi.currentTagName;
  }

  get methodOperationId(): string {
    return this.operation?.getOperationId() || "";
  }

  get className(): string {
    return (
      this.oldNode.classDeclaration?.getName() ??
      _.upperFirst(this.openapi.currentTagNameOfPinYin) +
        _.upperFirst(REQUEST_SUFFIX)
    );
  }

  get lowerFirstClassName(): string {
    return _.lowerFirst(this.className);
  }

  get fileName(): string {
    return (
      this.oldNode.classDeclaration?.getName() ??
      _.upperFirst(this.openapi.currentTagNameOfPinYin) + "." + REQUEST_SUFFIX
    );
  }

  get upperFirstNamespaceTypeName(): string {
    return (
      this.oldNode.typeNamespace.namedImport ||
      _.upperFirst(this.openapi.currentTagNameOfPinYin)
    );
  }

  get lowerFirstTypeFileName(): string {
    return (
      this.oldNode.typeNamespace.namedImport ||
      _.lowerFirst(this.openapi.currentTagNameOfPinYin) + "." + TYPE_SUFFIX
    );
  }

  get zodTypeName(): string {
    return (
      this.oldNode.zodNamespace.namedImport ||
      this.openapi.currentTagNameOfPinYin + _.upperFirst(ZOD_SUFFIX)
    );
  }

  get zodFileName(): string {
    return (
      this.oldNode.zodNamespace.namedImport ||
      this.openapi.currentTagNameOfPinYin + "." + ZOD_SUFFIX
    );
  }

  get isCreateZodDecorator(): boolean {
    if (this.pluginConfig === undefined) {
      return false;
    }
    return this.pluginConfig.createZodDecorator;
  }

  get isAxiosRequestType(): boolean {
    const requestType = this.pluginConfig.requestType;
    return requestType === RequestTypeEnum.AXIOS;
  }

  get isCommonRequestType(): boolean {
    const requestType = this.pluginConfig.requestType;
    return requestType === RequestTypeEnum.COMMON;
  }

  get isCommonWithArrayResponseRequestType(): boolean {
    const requestType = this.pluginConfig.requestType;
    return requestType === RequestTypeEnum.COMMON_WITH_ARRAY_RESPONSE;
  }

  get responseDataType(): string {
    return (
      this.upperFirstNamespaceTypeName +
      "." +
      this.openapi.upperFirstResponseName
    );
  }

  get hasZodPlugin() {
    return this.openapiToSingleConfig.pluginNames.includes(pluginEnum.Zod);
  }

  /**
   * Promise<[ApiType.FindByIdResponse]>
   */
  get returnType(): string {
    if (this.isAxiosRequestType) {
      return "";
    }
    const errorResponseType =
      this.upperFirstNamespaceTypeName +
      "." +
      this.openapi.upperFirstRequestName +
      "Error";

    return this.isCommonWithArrayResponseRequestType
      ? `Promise<[${errorResponseType},${this.responseDataType}]>`
      : ``;
  }

  get requestDataType(): string {
    return (
      this.upperFirstNamespaceTypeName +
      "." +
      this.openapi.upperFirstBodyDataName
    );
  }

  get requestConfigImportDeclaration() {
    return this.pluginConfig?.requestConfigTypeImportDeclaration;
  }

  build(context: PluginContext): void {
    _.forEach(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      this.oldNode.setCurrentSourceFile(
        this.classOperationIdPrefix + _.camelCase(tag),
      );

      const methodsStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);
          this.oldNode.setCurrentMethod(this.methodOperationId);
          return {
            sort: _.isNumber(this.oldNode.currentMethod?.sort)
              ? this.oldNode.currentMethod.sort
              : Number.MAX_SAFE_INTEGER,
            methodsStatements: this.generatorMethodsStatements(),
          };
        })
        .sort((a, b) => a.sort - b.sort)
        .map((x) => x.methodsStatements)
        .value();

      const filePath = path.resolve(
        this.openapiToSingleConfig.output.dir,
        this.oldNode.baseName || this.fileName + ".ts",
      );

      this.ast.createSourceFile(filePath, {
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
  generatorExport(): Array<VariableStatementStructure> {
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
   * import { paramsZodSchema, responseZodSchema, ZodValidation } from '@/utils/zod'
   * // ts type
   * import type { DrmsDynamicDataType } from './drmsDynamicDataZod'
   * // zod
   * import { Zod } from './drmsDynamicDataZod'
   * ```
   */
  generateImport(): Array<ImportDeclarationStructure> {
    const zodDecorator: ImportStatementsOmitKind = {
      namedImports: ["paramsZodSchema", "responseZodSchema", "ZodValidation"],
      moduleSpecifier:
        this.oldNode.zodDecoratorImport.moduleSpecifier ??
        this.pluginConfig?.zodDecoratorImportDeclaration?.moduleSpecifier ??
        "@/utils/zod",
    };

    const request: ImportStatementsOmitKind = {
      namedImports: ["request"],
      moduleSpecifier:
        this.oldNode.requestImport.moduleSpecifier ??
        this.pluginConfig?.requestImportDeclaration?.moduleSpecifier ??
        "@/utils/request",
    };

    const requestConfig: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: _.isEmpty(this.requestConfigImportDeclaration?.namedImports)
        ? ["AxiosRequestConfig"]
        : this.requestConfigImportDeclaration?.namedImports,
      moduleSpecifier:
        this.requestConfigImportDeclaration?.moduleSpecifier ?? "axios",
    };

    const typeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.upperFirstNamespaceTypeName],
      moduleSpecifier:
        this.oldNode.typeNamespace.moduleSpecifier ??
        `./${this.lowerFirstTypeFileName}`,
    };

    const zodModel: ImportStatementsOmitKind = {
      namedImports: [this.zodTypeName],
      moduleSpecifier:
        this.oldNode.zodNamespace.moduleSpecifier ?? `./${this.zodFileName}`,
    };

    const zodTypeModel: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: [this.upperFirstNamespaceTypeName],
      moduleSpecifier:
        this.oldNode.zodNamespace.moduleSpecifier ?? `./${this.zodFileName}`,
    };

    const axiosType: ImportStatementsOmitKind = {
      isTypeOnly: true,
      namedImports: ["AxiosResponse"],
      moduleSpecifier: "axios",
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .concat(this.isCreateZodDecorator ? [zodModel, zodDecorator] : [])
      .concat(
        this.hasZodPlugin || this.isCreateZodDecorator ? [zodTypeModel] : [],
      )
      .concat(!this.hasZodPlugin ? [typeModel] : [])
      .concat(this.isAxiosRequestType ? [axiosType] : [])
      .push(request)
      .push(requestConfig)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  generatorClass(
    methodsStatements: OptionalKind<MethodDeclarationStructure>[],
  ): ClassDeclarationStructure {
    const statements = {
      name: this.className,
      docs: [
        {
          description: "",
          tags: [
            {
              tagName: "tag",
              text: this.openapi.currentTagName,
            },
            {
              tagName: "description",
              text:
                this.openapi &&
                this.openapi.currentTagMetadata &&
                this.openapi.currentTagMetadata.description,
            },
            ...(this.pluginConfig?.compare
              ? [
                  {
                    tagName: UUID_TAG_NAME,
                    text: this.classOperationId,
                  },
                ]
              : []),
          ].filter((x) => x.text),
        },
      ],
      methods: methodsStatements,
    };
    return this.ast.generateClassStatements(statements);
  }

  /**
   * @example
   * ```
   *@ZodValidation
   *@responseZodSchema(ZOD.updateResponse)
   * ```
   */
  generatorMethodDecorators(): OptionalKind<DecoratorStructure>[] {
    return [
      {
        name: "ZodValidation",
      },
      {
        name: "responseZodSchema",
        arguments: [this.zodTypeName + "." + this.openapi.responseName],
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
  generatorMethodParameters(): OptionalKind<ParameterDeclarationStructure>[] {
    const queryParameters = {
      name: "params",
      hasQuestionToken: this.openapi.parameter?.isQueryOptional,
      type:
        this.upperFirstNamespaceTypeName +
        "." +
        this.openapi.upperFirstQueryRequestName,
      decorators: this.isCreateZodDecorator
        ? [
            {
              name: this.paramsZodSchema,
              arguments: [
                this.zodTypeName + "." + this.openapi.queryRequestName,
              ],
            },
          ]
        : [],
    };

    const bodyDataParameters = {
      name: "data",
      type: this.requestDataType,
      decorators: this.isCreateZodDecorator
        ? [
            {
              name: this.paramsZodSchema,
              arguments: [this.zodTypeName + "." + this.openapi.bodyDataName],
            },
          ]
        : [],
    };

    const pathParameters = _.chain(this.openapi.parameter?.parameters)
      .filter(["in", "path"])
      .map((item: OpenAPIV3.ParameterObject) => {
        return {
          name: _.camelCase(item.name),
          type:
            this.upperFirstNamespaceTypeName +
            "." +
            this.openapi.upperFirstPathRequestName +
            `['${_.camelCase(item.name)}']`,
          decorators: this.isCreateZodDecorator
            ? [
                {
                  name: this.paramsZodSchema,
                  arguments: [
                    this.zodTypeName +
                      "." +
                      this.openapi.pathRequestName +
                      ".shape" +
                      `.${_.camelCase(item.name)}`,
                  ],
                },
              ]
            : [],
        };
      })
      .value();
    //<AddPetMutationRequest>
    const axiosRequestConfigType = `Partial<AxiosRequestConfig${this.openapi.requestBody?.hasRequestBody ? `<${this.requestDataType}>` : ""}>`;
    const requestConfigNamedImports = _.head(
      this.requestConfigImportDeclaration?.namedImports,
    );
    const requestConfig = {
      name: "requestConfig",
      hasQuestionToken: true,
      type: requestConfigNamedImports
        ? `Partial<${requestConfigNamedImports}>`
        : axiosRequestConfigType,
    };

    return _.chain([] as any[])
      .concat(
        this.openapi.parameter?.hasPathParameters ? pathParameters : undefined,
      )
      .push(
        this.openapi.requestBody?.hasRequestBody
          ? bodyDataParameters
          : undefined,
      )
      .push(
        this.openapi.parameter?.hasQueryParameters
          ? queryParameters
          : undefined,
      )
      .push(requestConfig)
      .filter(Boolean)
      .value();
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
            leadingTrivia: "\n",
            tagName: "summary",
            text: this.operation?.getSummary(),
          },
          {
            tagName: "description",
            text: this.operation?.getDescription(),
          },
          ...(this.pluginConfig?.compare
            ? [
                {
                  tagName: UUID_TAG_NAME,
                  text: this.methodOperationId,
                },
              ]
            : []),
        ].filter((x) => x.text),
      },
    ];
  }

  generatorParamsSerializer(): string {
    if (!this.pluginConfig?.compare) {
      return `paramsSerializer(params:${this.upperFirstNamespaceTypeName + "." + this.openapi.upperFirstQueryRequestName}) {
            return qs.stringify(params)
        }`;
    }

    if (!this.oldNode.methodFullText?.includes("paramsSerializer")) {
      return "";
    }

    return this.oldNode.paramsSerializer || "";
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
      .push("method:" + "'" + this.operation?.method.toUpperCase() + "'")
      .push(header())
      .push("url:" + url.requestPath)
      .push(this.openapi.parameter?.hasQueryParameters ? "params" : "")
      .push(this.openapi.requestBody?.hasRequestBody ? `data` : "")
      .push(this.openapi.response?.isDownLoad ? "responseType:'blob'" : "")
      .push("...requestConfig")
      .push(
        this.openapi.parameter?.hasQueryParametersArray
          ? this.generatorParamsSerializer()
          : "",
      )
      .filter(Boolean)
      .join(",\n")
      .value();

    if (this.isCommonRequestType) {
      return `const res = await request<${this.responseDataType}>({
                 ${requestFuncContent}
    })
    return res.data`;
    }

    if (this.isCommonWithArrayResponseRequestType) {
      return `return request<${this.responseDataType}>({
                 ${requestFuncContent}
    })
    .then(
    res=>[undefined,res.data],
    rej=>[rej,undefined]
    )`;
    }

    //default  axios
    return `const res = await request${this.generatorAxiosType()}({
                 ${requestFuncContent}
    })
    return res.data`;
  }

  /**
   * <ResponseData,ResponseConfig<RequestData>,unknown>
   */
  generatorAxiosType(): string {
    const requestData = this.openapi.requestBody?.hasRequestBody
      ? this.requestDataType
      : undefined;
    const responseConfigType = this.responseDataType
      ? `AxiosResponse<${this.responseDataType}>`
      : "AxiosResponse";

    return `<${this.responseDataType},${responseConfigType},${requestData ?? "unknown"}>`;
  }

  generatorMethodsStatements(): MethodDeclarationStructure {
    const statement = {
      isAsync: this.isCommonWithArrayResponseRequestType ? false : true,
      name: this.oldNode.methodName ?? this.openapi.requestName,
      decorators: this.isCreateZodDecorator
        ? this.generatorMethodDecorators()
        : [],
      parameters: this.generatorMethodParameters(),
      returnType: "",
      docs: this.generatorMethodDocs(),
      statements: this.generatorMethodBody(),
    };

    return this.ast.generateMethodStatements(statement);
  }
}
