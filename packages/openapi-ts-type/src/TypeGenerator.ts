import path from "node:path";

import _ from "lodash";
import { VariableDeclarationKind } from "ts-morph";

import { modelFolderName } from "./utils/modelFolderName.ts";
import { Component } from "./Component.ts";
import { useEnumCache } from "./EnumCache.ts";
import { Schema } from "./Schema.ts";

import type { Operation } from "oas/operation";
import type OasTypes from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type {
  ImportDeclarationStructure,
  InterfaceDeclarationStructure,
  ModuleDeclarationStructure,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { EnumCache } from "./EnumCache.ts";
import type { Config } from "./types.ts";

type TypeStatements =
  | InterfaceDeclarationStructure
  | TypeAliasDeclarationStructure;

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;
type InterfaceStatementsOmitKind = Omit<InterfaceDeclarationStructure, "kind">;
type ObjectSchema = OpenAPIV3.BaseSchemaObject & {
  type: "object";
};

type ResponseObject = {
  code: string;
  jsonSchema?: {
    description?: string;
    label: string;
    schema: OasTypes.SchemaObject;
    type: string | string[];
  };
};

type ComponentObject = {
  [key: string]: OpenAPIV3.ReferenceObject | OasTypes.MediaTypeObject;
};

export class TypeGenerator {
  private operation: Operation | undefined;
  private oas: Config["oas"];
  private readonly paramsZodSchema: string;
  private readonly openapi: Config["openapi"];
  private readonly ast: Config["ast"];
  private readonly pluginConfig: Config["pluginConfig"];
  private readonly openapiToSingleConfig: Config["openapiToSingleConfig"];
  private enumCache: EnumCache = useEnumCache();
  private importCache: Set<string> = new Set<string>();
  private component: Component;
  private schema: Schema;

  private readonly modelFolderName: string = modelFolderName;
  constructor(config: Config) {
    this.oas = config.oas;
    this.ast = config.ast;
    this.pluginConfig = config.pluginConfig;
    this.openapiToSingleConfig = config.openapiToSingleConfig;
    this.openapi = config.openapi;
    this.paramsZodSchema = "paramsZodSchema";
    this.component = new Component(config);
    this.schema = new Schema(config);
  }

  get currentTagName() {
    return _.camelCase(
      this.openapi &&
        this.openapi.currentTagMetadata &&
        this.openapi.currentTagMetadata.name,
    );
  }
  get nameSpaceName(): string {
    return _.upperFirst(this.currentTagName);
  }

  get upperFirstNameSpaceName(): string {
    return _.upperFirst(this.currentTagName);
  }

  build(): void {
    _.mapValues(this.openapi.pathGroupByTag, (pathGroup, tag) => {
      const typeStatements = _.chain(pathGroup)
        .map(({ path, method, tag }) => {
          this.operation = this.openapi.setCurrentOperation(path, method, tag);
          return _.chain([] as Array<TypeStatements | null>)
            .concat(this.generateParametersType())
            .concat(this.generateRequestBodyType())
            .concat(this.generateResponseType())
            .filter(Boolean)
            .value() as Array<TypeStatements>;
        })
        .flatten()
        .filter((x) => !_.isEmpty(x))
        .value();

      const filePath = path.resolve(
        this.openapiToSingleConfig.output,
        this.upperFirstNameSpaceName + ".ts",
      );

      const refKey = [...this.openapi.refCache.keys()];

      this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(refKey),
          this.generateNameSpace(typeStatements),
        ],
      });

      this.openapi.resetRefCache();
    });
    this.component.generateComponentType();
    this.generateEnum();
    this.component.generateModelIndex();
  }

  /**
   * @example
   * ```
   * export const enum TaskStatus {
   *     WAIT_START = 'WAIT_START',
   *     PROCESSING = 'PROCESSING',
   *     FINISHED = 'FINISHED',
   * }
   *
   * export const enum TaskStatusLabel {
   *     WAIT_START:'WAIT_START',
   *     PROCESSING = 'PROCESSING',
   *     FINISHED = 'FINISHED',
   * }
   *
   * export const taskStatusOption = [
   *     { label: TaskStatusLabel.WAIT_START, value: TaskStatus.WAIT_START },
   *     { label: TaskStatusLabel.PROCESSING, value: TaskStatus.PROCESSING },
   *     { label: TaskStatusLabel.FINISHED, value: TaskStatus.FINISHED },
   * ];
   * ```
   */
  generateEnum(): void {
    //
    const labelStatements = _.chain(this.enumCache.entries())
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: _.upperFirst(_.camelCase(name)) + "Label",
              initializer: this.ast.generateObject(
                ((schema.enum || []) as Array<string>).reduce(
                  (obj, item: string) => {
                    const key: string = _.upperFirst(_.camelCase(item));
                    obj[key] = "''";
                    return obj;
                  },
                  {} as { [key: string]: string },
                ),
              ),
            },
          ],
          docs: [{ description: schema.description || "" }],
        });
      })
      .value();

    //enum
    const valueStatements = _.chain(this.enumCache.entries())
      .map(([schema, name]) => {
        return this.ast.generateEnumStatement({
          isConst: true,
          name: _.upperFirst(_.camelCase(name)),
          members: (schema.enum || []).map((item: string) => {
            return {
              name: _.upperFirst(_.camelCase(item)),
              value: item,
            };
          }),
          docs: [
            {
              description: schema.description,
            },
          ],
        });
      })
      .value();

    // option
    const optionStatements = _.chain(this.enumCache.entries())
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: name + "Option",
              initializer:
                "[" +
                (schema.enum || []).reduce((arr, item: string) => {
                  const obj = this.ast.generateObject({
                    label:
                      _.upperFirst(_.camelCase(name)) +
                      "Label" +
                      "." +
                      _.upperFirst(_.camelCase(item)),
                    value:
                      _.upperFirst(_.camelCase(name)) +
                      "." +
                      _.upperFirst(_.camelCase(item)),
                  });
                  return arr + (arr ? "," : "") + obj;
                }, "") +
                "]",
            },
          ],
          docs: [{ description: schema.description || "" }],
        });
      })
      .value();

    const enumPath = path.resolve(
      this.openapiToSingleConfig.output || "",
      this.modelFolderName,
      "enum" + ".ts",
    );

    return this.ast.createSourceFile(enumPath, {
      statements: [...labelStatements, ...valueStatements, ...optionStatements],
    });
  }

  /**
   *
   * @example
   * ```
   * // ts type
   * import type { DrmsDynamicDataType } from './drmsDynamicDataZod'
   * ```
   */
  generateImport(
    importModel: Array<string>,
  ): Array<ImportDeclarationStructure> {
    const model = _.chain(importModel)
      .map(($ref: string) => _.upperFirst(this.openapi.getRefAlias($ref)))
      .value();

    const typeModel: ImportStatementsOmitKind = {
      namedImports: [...model],
      isTypeOnly: true,
      moduleSpecifier: "./" + this.modelFolderName,
    };

    const statements = _.chain([] as Array<ImportStatementsOmitKind>)
      .push(typeModel)
      .filter(Boolean)
      .value();

    return this.ast.generateImportStatements(statements);
  }

  /**
   * @example
   * ```
   * export namespace Tag {
   *  export type queryRequest = object
   * }
   * ```
   */
  generateNameSpace(
    typeStatements: Array<TypeStatements>,
  ): ModuleDeclarationStructure {
    return this.ast.generateModuleStatements({
      docs: [{ description: this.openapi.currentTagMetadata?.description }],
      isExported: true,
      name: this.nameSpaceName,
      statements: typeStatements,
    });
  }

  generateParametersType(): Array<
    InterfaceDeclarationStructure | TypeAliasDeclarationStructure
  > {
    const queryStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "QueryParams",
      docs: [{ description: "queryParams" }],
      properties: this.schema.getBaseTypeFromSchema(
        this.openapi.parameter?.getParametersSchema("query") || null,
      ),
    });

    const pathStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "PathParams",
      docs: [{ description: "pathParams" }],
      properties: this.schema.getBaseTypeFromSchema(
        this.openapi.parameter?.getParametersSchema("path") || null,
      ),
    });
    //[mediaType, bodySchema, description]

    return _.chain(
      [] as Array<
        InterfaceDeclarationStructure | TypeAliasDeclarationStructure
      >,
    )
      .concat(this.openapi.parameter?.hasQueryParameters ? queryStatements : [])
      .concat(this.openapi.parameter?.hasPathParameters ? pathStatements : [])
      .filter(Boolean)
      .value();
  }

  generateResponseType(): Array<
    InterfaceDeclarationStructure | TypeAliasDeclarationStructure
  > {
    const codes = this.openapi.response?.getResponseStatusCodes || [];

    const successCode = (codes || []).filter((code) =>
      /^(2[0-9][0-9]|300)$/.test(code),
    );
    const errorCode = (codes || []).filter((code) =>
      /^([3-5][0-9][0-9])$/.test(code),
    );
    const isSuccessCode = (code: string) => /^(2[0-9][0-9]|300)$/.test(code);

    const responseObject = _.chain([...successCode, ...errorCode])
      .map((code) => {
        return {
          code,
          jsonSchema:
            _.head(this.openapi.response?.getResponseAsJSONSchema(code)) ||
            null,
        };
      })
      .filter((x) => {
        if (isSuccessCode(x.code)) {
          return !_.isNull(x.jsonSchema);
        }
        return true;
      })
      .value() as Array<ResponseObject>;

    const errorType = this.ast.generateTypeAliasStatements({
      name: this.openapi.upperFirstRequestName + "ErrorResponse",
      type:
        _.chain(errorCode)
          .map((code) => this.openapi.upperFirstRequestName + "Response" + code)
          .join("|")
          .value() || "unknown",
      docs: [{ description: "" }],
      isExported: true,
    });

    const successDefaultType = this.ast.generateTypeAliasStatements({
      name: this.openapi.upperFirstRequestName + "Response",
      type: "unknown",
      docs: [{ description: "" }],
      isExported: true,
    });

    return _.chain(responseObject)
      .map((responseObject) =>
        this.generateResponseSingleSchema(responseObject),
      )
      .concat(errorType)
      .concat(_.isEmpty(successCode) ? successDefaultType : [])
      .filter(Boolean)
      .value();
  }

  generateResponseSingleSchema({
    code,
    jsonSchema,
  }: ResponseObject):
    | InterfaceDeclarationStructure
    | TypeAliasDeclarationStructure {
    const schema = jsonSchema?.schema;
    const description = jsonSchema?.description;
    const isError = /^([3-5][0-9][0-9])$/.test(code);
    const name =
      this.openapi.upperFirstRequestName + "Response" + (isError ? code : "");

    if (!schema) {
      return this.ast.generateTypeAliasStatements({
        name,
        type: "unknown",
        docs: [{ description: "" }],
        isExported: true,
      });
    }

    if (this.openapi.isReference(schema)) {
      return this.ast.generateTypeAliasStatements({
        name,
        type: _.upperFirst(this.openapi.getRefAlias(schema.$ref)),
        docs: [{ description: description || "" }],
        isExported: true,
      });
    }

    if (schema.type === "object") {
      return this.ast.generateInterfaceStatements({
        isExported: true,
        name,
        docs: [{ description: description || "" }],
        properties: this.schema.getBaseTypeFromSchema(schema),
      });
    }

    return this.ast.generateTypeAliasStatements({
      name,
      type: this.schema.formatterSchemaType(schema),
      docs: [{ description: description || "" }],
      isExported: true,
    });
  }

  //SchemaObject
  generateRequestBodyType(): Array<TypeStatements> | null {
    const _bodySchema = this.openapi.requestBody?.getRequestBodySchema();
    if (_bodySchema === undefined || _.isBoolean(_bodySchema)) {
      return null;
    }
    let schema: OasTypes.SchemaObject | null = null;
    if ("schema" in _bodySchema) {
      schema = _bodySchema.schema || (null as OasTypes.SchemaObject | null);
    }

    if (_.isArray(_bodySchema)) {
      schema = _.get(
        _bodySchema,
        "[1].schema",
        null,
      ) as OasTypes.SchemaObject | null;
    }

    if (schema === null) {
      return null;
    }

    if (this.openapi.isReference(schema)) {
      return [
        this.ast.generateTypeAliasStatements({
          name: this.openapi.upperFirstRequestName + "BodyParams",
          type: _.upperFirst(this.openapi.getRefAlias(schema.$ref)),
          docs: [{ description: "" }],
          isExported: true,
        }),
      ];
    }

    if (schema.type === "array") {
      return [
        this.ast.generateTypeAliasStatements({
          name: this.openapi.upperFirstRequestName + "BodyParams",
          type: this.schema.formatterSchemaType(schema),
          docs: [{ description: "" }],
          isExported: true,
        }),
      ];
    }

    return [
      this.ast.generateInterfaceStatements({
        isExported: true,
        name: this.openapi.upperFirstRequestName + "BodyParams",
        docs: [{ description: "bodyParams" }],
        properties: this.schema.getBaseTypeFromSchema(schema),
      }),
    ];
  }
}
