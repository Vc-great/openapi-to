import path from "node:path";
import { createPlugin, pluginEnum } from "@openapi-to/core";
import {
	formatterModuleSpecifier,
	getRelativePath,
} from "@openapi-to/core/utils";
import { forEach, kebabCase, upperFirst } from "lodash-es";
import { Project } from "ts-morph";
import { buildEnum } from "@/builds/buildEnum.ts";
import { buildTypeImports } from "@/builds/buildTypeImports.ts";
import { buildComponentParameters } from "@/builds/components/buildComponentParameters.ts";
import { buildComponentsRequestBody } from "@/builds/components/buildComponentsRequestBody.ts";
import { buildComponentsResponse } from "@/builds/components/buildComponentsResponse.ts";
import type { SchemaDeclarationStructure } from "@/builds/components/buildSchemas.ts";
import { buildSchemas } from "@/builds/components/buildSchemas.ts";

import { collectEnumFormOperation } from "@/collect/collectEnumFormOperation.ts";
import {
	collectEnumsFromComponentParameters,
	collectEnumsFromComponentRequestBody,
	collectEnumsFromComponentSchema,
} from "@/collect/collectEnumsFromDocument.ts";
import {
	collectRefsFromComponentParameters,
	collectRefsFromComponentRequestBody,
	collectRefsFromComponentResponse,
} from "@/collect/collectRefsFromDocument.ts";
import { collectRefsFromOperation } from "@/collect/collectRefsFromOperation.ts";
import { collectRefsFromSchema } from "@/collect/collectRefsFromSchemas.ts";
import { EnumRegistry } from "@/EnumRegistry.ts";
import { getOperationTSTypeName } from "@/templates/operationTypeNameTemplate.ts";
import { getDataReturnType } from "@/utils/getDataReturnType.ts";
import { getRefFilePath } from "@/utils/getRefFilePath.ts";
import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";
import { buildOperationTypes } from "./builds/buildOperationTypes.ts";
import type { PluginConfig } from "./types.ts";

interface PluginState {
	project: Project;
	componentFolderPath: string;
	operationFileNameOfTag: Set<string>;
	enumRegistry: EnumRegistry;
}

const pluginStateKey = Symbol("@openapi-to/plugin-ts-type/state");

function getState(store: Map<unknown, unknown>): PluginState {
	const state = store.get(pluginStateKey);
	if (!state) throw new Error("Type plugin state was not initialized.");
	return state as PluginState;
}

export const definePlugin = createPlugin((pluginConfig?: PluginConfig) => {
	return {
		name: pluginEnum.TsType,
		hooks: {
			buildStart: async (ctx) => {
				ctx.store.set(pluginStateKey, {
					project: new Project(),
					componentFolderPath: path.join(
						ctx.openapiToSingleConfig.output.dir,
						"types",
					),
					operationFileNameOfTag: new Set(),
					enumRegistry: new EnumRegistry(),
				});
			},
			tagStart: async (_tagData, ctx) => {
				const state = getState(ctx.store);
				//tag开始时，清空当前tag的operation记录
				state?.operationFileNameOfTag.clear();
			},
			operation: async (operation, ctx) => {
				const {
					project,
					componentFolderPath,
					operationFileNameOfTag,
					enumRegistry,
				} = getState(ctx.store);
				const fileName = `${kebabCase(operation.accessor.operationName)}.types.ts`;
				const filePath = path.join(
					ctx.openapiToSingleConfig.output.dir,
					kebabCase(operation.tagName),
					fileName,
				);
				//`${ctx.openapiToSingleConfig.output.dir}${pluginConfig?.output.dir}/${lowerFirst(operation.formattedTagName)}/${fileName}.ts`
				operationFileNameOfTag.add(fileName);

				const operationEnums = collectEnumFormOperation(operation);

				enumRegistry.adds(operationEnums);

				const operationStatements = buildOperationTypes(operation);

				//保存类型名
				operation.accessor.setOperationTSType({
					...getOperationTSTypeName(operation),
					filePath,
				});

				operation.accessor.setDataReturnType(getDataReturnType(operation));

				const operationSourceFile = project.createSourceFile(filePath, "", {
					overwrite: true,
				});

				const imports = collectRefsFromOperation(operation).flatMap((ref) => {
					return buildTypeImports(
						[getUpperFirstRefAlias(ref)],
						formatterModuleSpecifier(
							getRelativePath(
								filePath,
								getRefFilePath(ref, componentFolderPath),
							),
							pluginConfig?.importWithExtension,
						),
					);
				});
				operationSourceFile.addStatements(imports);

				const enumNames = operationEnums.map((item) =>
					enumRegistry.getEnumValueName(item.enumValue, item.name),
				);
				operationSourceFile.addStatements(
					buildTypeImports(enumNames, "../types/enum.model.ts"),
				);

				operationSourceFile.addStatements(operationStatements);
				ctx.setSourceFiles(
					[
						pluginEnum.TsType,
						operation.tagName,
						operation.accessor.operationName,
					],
					operationSourceFile,
				);
			},
			tagEnd: async () => {},
			componentsSchemas: async (schemas, ctx) => {
				const { project, componentFolderPath, enumRegistry } = getState(
					ctx.store,
				);
				for (const [schemaName, schema] of Object.entries(schemas)) {

					const formatterSchemaName =
						ctx.openapiHelper.formatterName(schemaName);

					const fileName = `${kebabCase(formatterSchemaName)}.model.ts`;

					const filePath = path.join(
						ctx.openapiToSingleConfig.output.dir,
						"types",
						"models",
						fileName,
					);

					const enums = collectEnumsFromComponentSchema(
						schema,
						formatterSchemaName,
					);

					enumRegistry.adds(enums);

					const enumNames = enums.map((item) =>
						enumRegistry.getEnumValueName(item.enumValue, item.name),
					);

					const schemaSourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});
					const statements: SchemaDeclarationStructure[] = buildSchemas(
						formatterSchemaName,
						schema,
					);
					const refs = collectRefsFromSchema(schema);

					const imports = refs.flatMap((ref) => {
						return buildTypeImports(
							[getUpperFirstRefAlias(ref)],
							formatterModuleSpecifier(
								getRelativePath(
									filePath,
									getRefFilePath(ref, componentFolderPath),
								),
								pluginConfig?.importWithExtension,
							),
						);
					});

					schemaSourceFile.addStatements(imports);

					schemaSourceFile.addStatements(
						buildTypeImports(enumNames, "../enum.model.ts"),
					);
					schemaSourceFile.addStatements(statements);

					ctx.setSourceFiles(
						[pluginEnum.TsType, "componentsSchemas", schemaName],
						schemaSourceFile,
					);
				}
			},
			componentsParameters(parameters, ctx) {
				const { project, componentFolderPath, enumRegistry } = getState(
					ctx.store,
				);
				enumRegistry.adds(collectEnumsFromComponentParameters(parameters));

				const refs = collectRefsFromComponentParameters(parameters);

				forEach(parameters, (parameter, parameterName) => {
					const formatterParameterName =
						ctx.openapiHelper.formatterName(parameterName);

					const fileName = `${kebabCase(formatterParameterName)}.model.ts`;

					const filePath = path.join(
						componentFolderPath,
						"parameters",
						fileName,
					);
					const parameterSourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});
					const statements: SchemaDeclarationStructure | undefined =
						buildComponentParameters(parameter, formatterParameterName);
					if (statements) {
						const imports = refs.flatMap((ref) =>
							buildTypeImports(
								[getUpperFirstRefAlias(ref)],
								formatterModuleSpecifier(
									getRelativePath(
										filePath,
										getRefFilePath(ref, componentFolderPath),
									),
									pluginConfig?.importWithExtension,
								),
							),
						);

						parameterSourceFile.addStatements(imports);

						parameterSourceFile.addStatements([statements]);

						ctx.setSourceFiles(
							[pluginEnum.TsType, "componentsParameters", parameterName],
							parameterSourceFile,
						);
					}
				});
			},
			componentsRequestBodies(requestBodies, ctx) {
				const { project, componentFolderPath, enumRegistry } = getState(
					ctx.store,
				);
				// components.requestBodies
				for (const [requestBodyName, requestObject] of Object.entries(
					requestBodies,
				)) {
					const formatterName =
						ctx.openapiHelper.formatterName(requestBodyName);
					enumRegistry.adds(
						collectEnumsFromComponentRequestBody(requestObject, formatterName),
					);

					const refs = collectRefsFromComponentRequestBody(requestObject);

					const fileName = `${kebabCase(formatterName)}.model.ts`;

					//
					const filePath = path.join(
						componentFolderPath,
						"requestBodies",
						fileName,
					);
					const requestBodySourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});
					const statements: SchemaDeclarationStructure | undefined =
						buildComponentsRequestBody(formatterName, requestObject);
					if (statements) {
						const imports = refs.flatMap((ref) =>
							buildTypeImports(
								[getUpperFirstRefAlias(ref)],
								formatterModuleSpecifier(
									getRelativePath(
										filePath,
										getRefFilePath(ref, componentFolderPath),
									),
									pluginConfig?.importWithExtension,
								),
							),
						);

						requestBodySourceFile.addStatements(imports);

						requestBodySourceFile.addStatements([statements]);
						ctx.setSourceFiles(
							[pluginEnum.TsType, "componentsRequestBodies", requestBodyName],
							requestBodySourceFile,
						);
					}
				}
			},
			componentsResponses(responses, ctx) {
				const { project, componentFolderPath, enumRegistry } = getState(
					ctx.store,
				);
				// components.responses
				forEach(responses, (response, responseName) => {
					const formatterResponse =
						ctx.openapiHelper.formatterName(responseName);

					enumRegistry.adds(
						collectEnumsFromComponentSchema(response, formatterResponse),
					);

					const responseTypeName = `Response${upperFirst(formatterResponse)}`;
					//todo responses
					const statements = buildComponentsResponse(
						response,
						responseTypeName,
					);

					const refs = collectRefsFromComponentResponse(response);

					const fileName = `${kebabCase(formatterResponse)}.model.ts`;

					const filePath = path.join(
						componentFolderPath,
						"responses",
						fileName,
					);

					const responseSourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});

					if (statements) {
						const imports = refs.flatMap((ref) =>
							buildTypeImports(
								[getUpperFirstRefAlias(ref)],
								formatterModuleSpecifier(
									getRelativePath(
										filePath,
										getRefFilePath(ref, componentFolderPath),
									),
									pluginConfig?.importWithExtension,
								),
							),
						);

						responseSourceFile.addStatements(imports);
						responseSourceFile.addStatements([statements]);
						ctx.setSourceFiles(
							[pluginEnum.TsType, "componentsResponses", responseName],
							responseSourceFile,
						);
					}
				});
			},
			buildEnd: async (ctx) => {
				const { project, componentFolderPath, enumRegistry } = getState(
					ctx.store,
				);
				const enumVariableStatements = buildEnum(enumRegistry.getAll());
				const filePath = path.join(componentFolderPath, "enum.model.ts");
				const enumSourceFile = project.createSourceFile(filePath, "", {
					overwrite: true,
				});
				enumSourceFile.addStatements(enumVariableStatements);
				ctx.setSourceFiles([pluginEnum.TsType, "enum.model"], enumSourceFile);
			},
		},
	};
});
