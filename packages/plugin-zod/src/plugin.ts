import path from "node:path";
import type { OpenapiToSingleConfig } from "@openapi-to/core";
import { createPlugin, pluginEnum } from "@openapi-to/core";
import {
	formatterModuleSpecifier,
	getRelativePath,
} from "@openapi-to/core/utils";
import { forEach, kebabCase, upperFirst } from "lodash-es";
import { Project } from "ts-morph";
import { buildSchemaImports } from "@/builds/buildSchemaImports.ts";
import { buildComponentParameters } from "@/builds/components/buildComponentParameters.ts";
import { buildComponentsRequestBody } from "@/builds/components/buildComponentsRequestBody.ts";
import { buildComponentsResponse } from "@/builds/components/buildComponentsResponse.ts";
import { buildSchemas } from "@/builds/components/buildSchemas.ts";
import {
	collectRefsFromComponentParameters,
	collectRefsFromComponentRequestBody,
	collectRefsFromComponentResponse,
} from "@/collect/collectRefsFromDocument.ts";
import { collectRefsFromOperation } from "@/collect/collectRefsFromOperation.ts";
import { collectRefsFromSchema } from "@/collect/collectRefsFromSchemas.ts";
import { findRecursiveSchemaRefs } from "@/collect/findRecursiveSchemaRefs.ts";
import { importZodTemplate } from "@/templates/importZodTemplate.ts";
import { getOperationZodSchemaName } from "@/templates/operationTypeNameTemplate.ts";
import { getlowerFirstRefAlias } from "@/utils/getlowerFirstRefAlias.ts";
import { getRefFilePath } from "@/utils/getRefFilePath.ts";
import { buildOperationTypes } from "./builds/buildOperationTypes.ts";
import type { PluginConfig } from "./types.ts";

const schemaFolderName = "zod";

const stateMap = new WeakMap<
	OpenapiToSingleConfig,
	{
		project: Project;
		componentOutputDir: string;
	}
>();

function getState(config: OpenapiToSingleConfig) {
	const state = stateMap.get(config);
	if (!state) {
		throw new Error("Zod plugin build state was not initialized.");
	}
	return state;
}

export const definePlugin = createPlugin((pluginConfig?: PluginConfig) => {
	return {
		name: pluginEnum.Zod,
		hooks: {
			buildStart: async (ctx) => {
				stateMap.set(ctx.openapiToSingleConfig, {
					project: new Project(),
					componentOutputDir: path.join(
						ctx.openapiToSingleConfig.output.dir,
						schemaFolderName,
					),
				});
			},
			operation: async (operation, ctx) => {
				const { project, componentOutputDir } = getState(
					ctx.openapiToSingleConfig,
				);
				const fileName = `${kebabCase(operation.accessor.operationName)}.schema.ts`;
				const filePath = path.join(
					ctx.openapiToSingleConfig.output.dir,
					kebabCase(operation.tagName),
					fileName,
				);
				const operationStatements = buildOperationTypes(operation);

				//
				operation.accessor.setOperationZodSchemaName({
					...getOperationZodSchemaName(operation),
					filePath,
				});

				const operationSourceFile = project.createSourceFile(filePath, "", {
					overwrite: true,
				});

				const imports = collectRefsFromOperation(operation).flatMap((ref) => {
					return buildSchemaImports(
						[getlowerFirstRefAlias(ref)],
						formatterModuleSpecifier(
							getRelativePath(
								filePath,
								getRefFilePath(ref, componentOutputDir),
							),
							pluginConfig?.importWithExtension,
						),
					);
				});

				operationSourceFile.addStatements([
					...imports,
					importZodTemplate,
					...operationStatements,
				]);
				ctx.setSourceFiles(
					[pluginEnum.Zod, operation.tagName, operation.accessor.operationName],
					operationSourceFile,
				);
			},
			componentsSchemas: async (schemas, ctx) => {
				const { project, componentOutputDir } = getState(
					ctx.openapiToSingleConfig,
				);
				const recursiveRefs = findRecursiveSchemaRefs(schemas);
				for (const [schemaName, schema] of Object.entries(schemas)) {
					const formatterSchemaName =
						ctx.openapiHelper.formatterName(schemaName);

					const fileName = `${kebabCase(formatterSchemaName)}.schema.ts`;

					const filePath = path.join(componentOutputDir, "models", fileName);

					const schemaSourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});
					const statements = buildSchemas(
						formatterSchemaName,
						schema,
						{
							lazyRefs: recursiveRefs,
							onDiagnostic(diagnostic) {
								ctx.addDiagnostic({
									...diagnostic,
									severity: "warning",
									plugin: pluginEnum.Zod,
									location: {
										path: ["components", "schemas", schemaName],
									},
								});
							},
						},
						schemaName,
					);
					const selfRef = `#/components/schemas/${schemaName}`;
					const refs = collectRefsFromSchema(schema).filter(
						(ref) => ref !== selfRef,
					);

					const imports = refs.flatMap((ref) =>
						buildSchemaImports(
							[getlowerFirstRefAlias(ref)],
							formatterModuleSpecifier(
								getRelativePath(
									filePath,
									getRefFilePath(ref, componentOutputDir),
								),
								pluginConfig?.importWithExtension,
							),
						),
					);

					schemaSourceFile.addStatements([
						...imports,
						importZodTemplate,
						statements,
					]);

					ctx.setSourceFiles(
						[pluginEnum.Zod, "componentsSchemas", schemaName],
						schemaSourceFile,
					);
				}
			},
			componentsParameters(parameters, ctx) {
				const { project, componentOutputDir } = getState(
					ctx.openapiToSingleConfig,
				);
				const refs = collectRefsFromComponentParameters(parameters);

				forEach(parameters, (parameter, parameterName) => {
					const formatterParameterName =
						ctx.openapiHelper.formatterName(parameterName);

					const fileName = `${kebabCase(formatterParameterName)}.schema.ts`;

					const filePath = path.join(
						componentOutputDir,
						"parameters",
						fileName,
					);
					const parameterSourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});
					const statements = buildComponentParameters(
						parameter,
						formatterParameterName,
					);
					if (!statements) {
						return;
					}
					const imports = refs.flatMap((ref) =>
						buildSchemaImports(
							[getlowerFirstRefAlias(ref)],
							formatterModuleSpecifier(
								getRelativePath(
									filePath,
									getRefFilePath(ref, componentOutputDir),
								),
								pluginConfig?.importWithExtension,
							),
						),
					);

					parameterSourceFile.addStatements([
						...imports,
						importZodTemplate,
						statements,
					]);

					ctx.setSourceFiles(
						[pluginEnum.Zod, "componentsParameters", parameterName],
						parameterSourceFile,
					);
				});
			},
			componentsRequestBodies(requestBodies, ctx) {
				const { project, componentOutputDir } = getState(
					ctx.openapiToSingleConfig,
				);
				// components.requestBodies
				for (const [requestBodyName, requestObject] of Object.entries(
					requestBodies,
				)) {
					const formatterName =
						ctx.openapiHelper.formatterName(requestBodyName);

					const refs = collectRefsFromComponentRequestBody(requestObject);

					const fileName = `${kebabCase(formatterName)}.schema.ts`;

					const filePath = path.join(
						componentOutputDir,
						"requestBodies",
						fileName,
					);
					const requestBodySourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});
					const statements = buildComponentsRequestBody(
						formatterName,
						requestObject,
					);
					if (!statements) {
						return;
					}
					const imports = refs.flatMap((ref) =>
						buildSchemaImports(
							[getlowerFirstRefAlias(ref)],
							formatterModuleSpecifier(
								getRelativePath(
									filePath,
									getRefFilePath(ref, componentOutputDir),
								),
								pluginConfig?.importWithExtension,
							),
						),
					);

					requestBodySourceFile.addStatements([
						...imports,
						importZodTemplate,
						statements,
					]);
					ctx.setSourceFiles(
						[pluginEnum.Zod, "componentsRequestBodies", requestBodyName],
						requestBodySourceFile,
					);
				}
			},
			componentsResponses(responses, ctx) {
				const { project, componentOutputDir } = getState(
					ctx.openapiToSingleConfig,
				);
				// components.responses
				forEach(responses, (response, responseName) => {
					const formatterResponse =
						ctx.openapiHelper.formatterName(responseName);

					const responseTypeName = `Response${upperFirst(formatterResponse)}`;
					//todo responses
					const statements = buildComponentsResponse(
						response,
						responseTypeName,
					);

					const refs = collectRefsFromComponentResponse(response);

					const fileName = `${kebabCase(formatterResponse)}.schema.ts`;

					const filePath = path.join(componentOutputDir, "responses", fileName);

					const responseSourceFile = project.createSourceFile(filePath, "", {
						overwrite: true,
					});

					if (!statements) {
						return;
					}
					const imports = refs.flatMap((ref) =>
						buildSchemaImports(
							[getlowerFirstRefAlias(ref)],
							formatterModuleSpecifier(
								getRelativePath(
									filePath,
									getRefFilePath(ref, componentOutputDir),
								),
								pluginConfig?.importWithExtension,
							),
						),
					);

					responseSourceFile.addStatements([
						...imports,
						importZodTemplate,
						statements,
					]);
					ctx.setSourceFiles(
						[pluginEnum.Zod, "componentsResponses", responseName],
						responseSourceFile,
					);
				});
			},
		},
	};
});
