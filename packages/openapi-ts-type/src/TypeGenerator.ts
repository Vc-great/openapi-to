import path from "node:path";

import _ from "lodash";
import { StructureKind, VariableDeclarationKind } from "ts-morph";

import type {
  AST,
  OpenAPI,
  OpenapiToSingleConfig,
  PluginContext,
} from "@openapi-to/core";
import type Oas from "oas";
import type { Operation } from "oas/operation";
import type OasTypes from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { StatementStructures } from "ts-morph";
import type {
  ImportDeclarationStructure,
  InterfaceDeclarationStructure,
  ModuleDeclarationStructure,
  OptionalKind,
  PropertySignatureStructure,
  TypeAliasDeclarationStructure,
} from "ts-morph";
import type { PluginConfig } from "./types.ts";

type RequestGeneratorParams = {
  oas: Oas;
  openapi: OpenAPI;
  ast: AST;
  pluginConfig: PluginConfig;
  openapiToSingleConfig: OpenapiToSingleConfig;
};

type TypeStatements =
  | InterfaceDeclarationStructure
  | TypeAliasDeclarationStructure;

type OptionalKindOfPropertySignatureStructure =
  OptionalKind<PropertySignatureStructure>;
type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;
type InterfaceStatementsOmitKind = Omit<InterfaceDeclarationStructure, "kind">;
type ObjectSchema = OpenAPIV3.BaseSchemaObject & {
  type: "object";
};

type ResponseObject = {
  description?: string;
  label: string;
  schema: OasTypes.SchemaObject;
  type: string | string[];
};

type ComponentObject = {
  [key: string]: OpenAPIV3.ReferenceObject | OasTypes.MediaTypeObject;
};

export class TypeGenerator {
  private operation: Operation | undefined;
  private oas: RequestGeneratorParams["oas"];
  private readonly paramsZodSchema: string;
  private readonly openapi: RequestGeneratorParams["openapi"];
  private readonly ast: RequestGeneratorParams["ast"];
  private readonly pluginConfig: RequestGeneratorParams["pluginConfig"];
  private readonly openapiToSingleConfig: RequestGeneratorParams["openapiToSingleConfig"];
  private enumCache: Map<OasTypes.SchemaObject, string> = new Map<
    OasTypes.SchemaObject,
    string
  >();
  private importCache: Set<string> = new Set<string>();
  private context: PluginContext | null = null;
  private modelIndex: Set<string> = new Set<string>();
  private readonly modelFolderName: string = "models";
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
    return _.camelCase(
      this.openapi &&
        this.openapi.currentTagMetadata &&
        this.openapi.currentTagMetadata.name,
    );
  }

  get upperFirstCurrentTagName(): string {
    return _.upperFirst(this.currentTagName);
  }

  get nameSpaceName(): string {
    return _.upperFirst(this.currentTagName);
  }

  get upperFirstNameSpaceName(): string {
    return _.upperFirst(this.currentTagName);
  }

  //todo unknown or any
  get unknownReturn(): string {
    return "unknown";
  }

  build(context: PluginContext): void {
    this.context = context;
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
        context.output,
        this.upperFirstNameSpaceName + ".ts",
      );

      return this.ast.createSourceFile(filePath, {
        statements: [
          ...this.generateImport(),
          this.generateNameSpace(typeStatements),
        ],
      });
    });
    this.generateComponentType();
    this.generateModelIndex();
    //todo enum
    //this.generateEnum(),
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
  generateEnum() {
    const enumCache: Array<[OasTypes.SchemaObject, string]> = [];
    for (const [schema, name] of this.enumCache) {
      enumCache.push([schema, name]);
    }

    // label
    const label = _.chain(enumCache)
      .map(([schema, name]) => {
        return this.ast.generateVariableStatements({
          declarationKind: VariableDeclarationKind.Const,
          isExported: true,
          declarations: [
            {
              name: name + "Label",
              initializer: this.ast.generateObjectType(
                (schema.enum || []).map((item: string) => {
                  return {
                    name: item,
                    type: "",
                  };
                }),
              ),
            },
          ],
          docs: [{ description: schema.description || "" }],
        });
      })
      .value();
    /*

    //enum
    const enumValue = _.chain(enumCache)
      .map(([schema, name]) => {
        return this.ast.generateEnumStatement({
          isConst: true,
          name,
          members: (schema.enum || []).map((item: string) => {
            return {
              name: item,
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
    const option = _.chain(enumCache)
      .map(([schema, name]) => {
        return _.chain(schema.enum)
          .map((item) => {
            return this.ast.generateObjectType([
              {
                name: "label",
                type: item,
              },
              {
                name: "value",
                type: item,
              },
            ]);
          })
          .reduce((arr, item) => {
            arr.push(item);
            return arr;
          }, []);
      })
      .value();
*/

    return label;
  }

  /**
   *
   * @example
   * ```
   * // ts type
   * import type { DrmsDynamicDataType } from './drmsDynamicDataZod'
   * ```
   */
  generateImport(): Array<ImportDeclarationStructure> {
    const model = _.chain([...this.openapi.refCache.keys()] as Array<string>)
      .map(($ref: string) => this.openapi.getRefAlias($ref))
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

  /**

   _.chain(this.openapi.parameter?.getParametersSchema("query"))
   .reduce((result, schemaObject: OasTypes.SchemaObject, key) => {
   return [
   ...result,
   {
   name: key,
   type: this.getBaseTypeFromSchema(schemaObject),
   docs: [{ description: schemaObject.description }],
   },
   ];
   }, [] as Array<InterfaceStatementsOmitKind>)
   .value()

   */

  /**
   *
   *
   */
  generateParametersType(): Array<
    InterfaceDeclarationStructure | TypeAliasDeclarationStructure
  > {
    const queryStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "QueryParams",
      docs: [{ description: "queryParams" }],
      properties: this.getBaseTypeFromSchema(
        this.openapi.parameter?.getParametersSchema("query") || null,
      ),
    });

    const pathStatements = this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "PathParams",
      docs: [{ description: "pathParams" }],
      properties: this.getBaseTypeFromSchema(
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
    const codes = this.openapi.response?.getResponseStatusCodes;
    const successCode = (codes || []).filter((code) =>
      /^(2[0-9][0-9]|300)$/.test(code),
    );
    const errorCode = (codes || []).filter((code) =>
      /^([3-5][0-9][0-9])$/.test(code),
    );
    //success
    const successSchema = _.chain(successCode)
      .map(
        (code) =>
          _.head(this.openapi.response?.getResponseAsJSONSchema(code)) || null,
      )
      .filter(Boolean)
      .value() as Array<ResponseObject>;
    //error
    const errorSchema = _.chain(errorCode)
      .map(
        (code) =>
          _.head(this.openapi.response?.getResponseAsJSONSchema(code)) || null,
      )
      .filter(Boolean)
      .value() as Array<ResponseObject>;

    return _.chain([...successSchema, ...errorSchema])
      .map((schema) => this.generateResponseSingleSchema(schema))
      .filter(Boolean)
      .value();
  }

  generateResponseSingleSchema({
    description,
    label,
    schema,
    type,
  }: ResponseObject):
    | InterfaceDeclarationStructure
    | TypeAliasDeclarationStructure {
    if (this.openapi.isReference(schema)) {
      return this.ast.generateTypeAliasStatements({
        name: this.openapi.upperFirstRequestName + "Response",
        type: this.openapi.getRefAlias(schema.$ref),
        docs: [{ description }],
        isExported: true,
      });
    }

    if (schema.type === "array") {
      return this.ast.generateTypeAliasStatements({
        name: this.openapi.upperFirstRequestName + "Response",
        type: this.formatterSchemaType(schema),
        docs: [{ description }],
        isExported: true,
      });
    }

    return this.ast.generateInterfaceStatements({
      isExported: true,
      name: this.openapi.upperFirstRequestName + "Response",
      docs: [{ description: "bodyParams" }],
      properties: this.getBaseTypeFromSchema(schema),
    });
  }

  generateComponentRefType(
    schema: OpenAPIV3.ReferenceObject,
    typeName: string,
  ): void {
    this.createModelSourceFile(
      [
        ...this.ast.generateImportStatements([
          {
            namedImports: [this.openapi.getRefAlias(schema.$ref)],
            isTypeOnly: true,
            moduleSpecifier: `/model/index`,
          },
        ]),
        this.ast.generateTypeAliasStatements({
          name: _.upperFirst(_.camelCase(typeName)),
          type: this.openapi.getRefAlias(schema.$ref),
          //todo
          docs: [{ description: "" }],
          isExported: true,
        }),
      ],
      _.upperFirst(_.camelCase(typeName)),
    );
  }

  /**
   * schema type
   * @param schema
   * @param typeName
   */
  generateComponentSchemaType(
    schema: OasTypes.SchemaObject,
    typeName: string,
  ): void {
    this.openapi.resetRefCache();

    const schemaStatuments = this.ast.generateInterfaceStatements({
      isExported: true,
      name: _.upperFirst(_.camelCase(typeName)),
      //todo
      docs: [{ description: schema.description || "" }],
      properties: this.getBaseTypeFromSchema(schema),
    });
    const importStatements = _.chain([...this.openapi.refCache.keys()])
      .map((ref) => {
        return this.ast.generateImportStatements([
          {
            namedImports: [this.openapi.getRefAlias(ref)],
            isTypeOnly: true,
            moduleSpecifier: "./" + this.openapi.getRefAlias(ref),
          },
        ]);
      })
      .flatten()
      .value();

    this.createModelSourceFile(
      [...importStatements, schemaStatuments],
      _.upperFirst(_.camelCase(typeName)),
    );
  }

  generateComponentObjectType(
    componentObject: ComponentObject | null | undefined,
  ): void {
    if (!componentObject) {
      return;
    }

    const name = _.chain(Object.keys(componentObject))
      .head()
      .camelCase()
      .upperFirst()
      .value();
    const typeName = _.upperFirst(_.camelCase(name));
    const value:
      | OpenAPIV3.ReferenceObject
      | OasTypes.MediaTypeObject
      | undefined = _.head(Object.values(componentObject));

    if (!name || !value) {
      return;
    }

    if (this.openapi.isReference(value)) {
      this.generateComponentRefType(value, typeName);
      return;
    }

    let schema: OasTypes.SchemaObject | null = null;

    if ("schema" in value) {
      schema = value.schema || (null as OasTypes.SchemaObject | null);
    }

    if (schema === null) {
      return;
    }
    if (this.openapi.isReference(schema)) {
      this.generateComponentRefType(schema, typeName);
      return;
    }

    if (schema.type === "array") {
      this.createModelSourceFile(
        [
          this.ast.generateTypeAliasStatements({
            name: _.upperFirst(_.camelCase(typeName)),
            type: this.formatterSchemaType(schema),
            //todo
            docs: [{ description: "" }],
            isExported: true,
          }),
        ],
        name,
      );
      return;
    }

    this.generateComponentSchemaType(schema, typeName);
  }

  createModelSourceFile(
    statements: Array<StatementStructures>,
    fileName: string,
  ): void {
    const filePath = path.resolve(
      this.context?.output || "./",
      this.modelFolderName + "/" + fileName + ".ts",
    );

    this.ast.createSourceFile(filePath, {
      //...(this.generateModelImport() || [])
      statements,
    });

    //
    this.setModelIndexStatements(statements);
  }

  setModelIndexStatements(statements: Array<StatementStructures>): void {
    const whiteKind = [StructureKind.TypeAlias, StructureKind.Interface];

    const names = _.chain(statements)
      .filter((item) => whiteKind.includes(item.kind))
      .map(
        (item: TypeAliasDeclarationStructure | InterfaceDeclarationStructure) =>
          item.name,
      )
      .value() as unknown as string[];

    _.forEach(names, (name) => this.modelIndex.add(name));
  }

  generateModelIndex(): void {
    const statements = _.chain([...this.modelIndex])
      .map((name) =>
        this.ast.generateExportStatements({
          moduleSpecifier: "./" + name,
        }),
      )
      .value();

    this.createModelSourceFile(statements, "index");
  }

  /**
   *
   * @param context
   * ```
   * import {Order} from './models'
   * export interface Response {
   * order:Order
   * }
   *
   * ```
   */
  generateComponentType(): void {
    //todo requestBodies
    //this.generateComponentObjectType(this.openapi.component.requestBodyObject);
    _.forEach(this.openapi.component.schemas, (schema, key) => {
      if (this.openapi.isReference(schema)) {
        this.generateComponentRefType(schema, key);
        return;
      }

      this.generateComponentSchemaType(schema, key);
    });

    // const refCache = [...this.openapi.refCache.keys()];

    /*    _.forEach(refCache, (ref) => {
      const schema = this.openapi.findSchemaBy$ref(
        ref,
      ) as OasTypes.SchemaObject;
      const name = this.openapi.getRefAlias(ref);
      const statements = this.ast.generateInterfaceStatements({
        isExported: true,
        name: name,
        docs: [{ description: schema.description }],
        properties: this.getBaseTypeFromSchema(schema),
      });

      const filePath = path.resolve(context.output, "/models" + name + ".ts");

      this.ast.createSourceFile(filePath, {
        statements: [...this.generateModelImport(), statements],
      });

      this.openapi.setRefCache(ref, { writeModel: "succeed" });
    });*/
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
          type: this.openapi.getRefAlias(schema.$ref),
          docs: [{ description: "" }],
          isExported: true,
        }),
      ];
    }

    if (schema.type === "array") {
      return [
        this.ast.generateTypeAliasStatements({
          name: this.openapi.upperFirstRequestName + "BodyParams",
          type: this.formatterSchemaType(schema),
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
        properties: this.getBaseTypeFromSchema(schema),
      }),
    ];
  }

  getBaseTypeFromSchema(
    schema: OasTypes.SchemaObject | null,
  ): Array<OptionalKindOfPropertySignatureStructure> | undefined {
    const version = this.oas.getVersion();

    if (!schema) {
      return undefined;
    }

    /*    if (this.openapi.isReference(schema)) {
      return this.openapi.getRefAlias(schema);
    }*/

    if (schema.oneOf) {
      return undefined;
    }

    if (schema.anyOf) {
      return undefined;
    }

    if (schema.allOf) {
      return undefined;
    }

    if (schema.enum) {
      return undefined;
    }

    if ("items" in schema) {
      // items -> array
      return undefined;
    }

    /**
     * OpenAPI 3.1
     * @link https://json-schema.org/understanding-json-schema/reference/array.html#tuple-validation
     */

    if ("prefixItems" in schema) {
      return undefined;
    }

    if (schema.properties || schema.additionalProperties) {
      // properties -> literal type
      return this.getTypeStringFromProperties(schema);
    }

    /**
     * validate "const" property as defined in JSON-Schema-Validation
     *
     * https://json-schema.org/draft/2020-12/json-schema-validation#name-const
     *
     * > 6.1.3. const
     * > The value of this keyword MAY be of any type, including null.
     * > Use of this keyword is functionally equivalent to an "enum" (Section 6.1.2) with a single value.
     * > An instance validates successfully against this keyword if its value is equal to the value of the keyword.
     */
    if (version === "3.1" && "const" in schema) {
      // const keyword takes precendence over the actual type.
    }

    /*    if (schema.type) {
      if (Array.isArray(schema.type)) {
        // TODO  remove hardcoded first type, second nullable
        // OPENAPI v3.1.0: https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0
        const [type, nullable] =
          schema.type as Array<OpenAPIV3_1.NonArraySchemaObjectType>;

        return factory.createUnionDeclaration({
          nodes: [
            this.getTypeFromSchema(
              {
                ...schema,
                type,
              },
              baseName,
            ),
            nullable
              ? factory.createLiteralTypeNode(factory.createNull())
              : undefined,
          ].filter(Boolean),
        });
      }

      if (
        this.options.dateType === "date" &&
        ["date", "date-time"].some((item) => item === schema.format)
      ) {
        return factory.createTypeReferenceNode(
          factory.createIdentifier("Date"),
        );
      }

      // string, boolean, null, number
      if (schema.type in factory.keywordTypeNodes) {
        return factory.keywordTypeNodes[
          schema.type as keyof typeof factory.keywordTypeNodes
        ];
      }
    }

    if (schema.format === "binary") {
      return factory.createTypeReferenceNode("Blob", []);
    }*/

    return undefined;
  }

  getTypeStringFromProperties(
    baseSchema?: OasTypes.SchemaObject,
  ): Array<OptionalKindOfPropertySignatureStructure> | undefined {
    const properties = baseSchema?.properties || {};
    const required = baseSchema?.required;
    const additionalProperties = baseSchema?.additionalProperties;

    const typeStatements: Array<OptionalKindOfPropertySignatureStructure> =
      Object.keys(properties).map((name) => {
        const schema = properties[name] as OasTypes.SchemaObject;

        const isRequired = _.chain([] as Array<string>)
          .push(_.isBoolean(required) ? name : "")
          .concat(_.isArray(required) ? required : "")
          .filter(Boolean)
          .includes(name)
          .value();

        //
        if (schema.enum) {
          this.enumCache.set(schema.enum, name);
        }

        return {
          name: _.camelCase(name) + (isRequired ? "" : "?"),
          type: this.openapi.isReference(schema)
            ? this.openapi.getRefAlias(schema.$ref)
            : this.formatterSchemaType(schema),
          docs: [{ description: _.get(schema, "description", "") }],
        };
      });

    //todo additionalProperties
    if (additionalProperties) {
      return undefined;
    }

    return typeStatements;
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
      name: "",
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

  formatterSchemaType(schema: OasTypes.SchemaObject | undefined): string {
    const numberEnum = [
      "int32",
      "int64",
      "float",
      "double",
      "integer",
      "long",
      "number",
      "int",
    ];

    const stringEnum = ["string", "email", "password", "url", "byte", "binary"];
    // const dateEnum = ["Date", "date", "dateTime", "date-time", "datetime"];

    if (_.isUndefined(schema)) {
      return "unknown";
    }

    const type = schema.type;
    if (typeof type !== "string") {
      return "unknown";
    }

    if (numberEnum.includes(type) || numberEnum.includes(schema.format || "")) {
      return "number";
    }

    /*   if (dateEnum.includes(type)) {
      return "Date";
    }*/

    if (stringEnum.includes(type || "")) {
      return "string";
    }

    if (type === "boolean") {
      return "boolean";
    }

    if (type === "array" && this.openapi.isReference(schema.items)) {
      return this.openapi.getRefAlias(schema.items.$ref);
    }

    if (type === "array" && !this.openapi.isReference(schema.items)) {
      const arrayType = this.formatterSchemaType(
        schema.items as OasTypes.SchemaObject,
      );
      return `Array<${arrayType}>`;
    }

    //todo 嵌套object
    if (type === "object" && schema.properties) {
      return this.ast.generateObjectType(
        this.getTypeStringFromProperties(schema) || [],
      );
      //return this.getTypeStringFromProperties(schema as ObjectSchema);
    }

    return "unknown";
  }
}
