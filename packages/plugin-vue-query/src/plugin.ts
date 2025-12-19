import path from "node:path";
import type { OpenapiToSingleConfig } from "@openapi-to/core";
import { createPlugin, pluginEnum } from "@openapi-to/core";
import { kebabCase, upperFirst } from "lodash-es";
import { OpenAPIV3 } from "openapi-types";
import { Project, StructureKind } from "ts-morph";
import { buildQueryGenericType } from "./builders/buildGenericType.ts";
import { buildImports } from "./builders/buildImports.ts";
import { buildMethodBody } from "./builders/buildMethodBody.ts";
import { buildMethodParameters } from "./builders/buildMethodParameters.ts";
import { buildQueryKey, buildQueryKeyType } from "./builders/buildQueryKey.ts";
import { buildTVariables } from "./builders/buildTVariables.ts";
import { buildTypeParameters } from "./builders/buildTypeParameters.ts";
import { jsDocTemplateFromMethod } from "./templates/jsDocTemplateFromMethod.ts";
import type { PluginConfig, RequiredPluginConfig } from "./types.ts";

import HttpMethods = OpenAPIV3.HttpMethods;

const stateMap = new WeakMap<
	OpenapiToSingleConfig,
	{
		project: Project;
		pluginConfig: RequiredPluginConfig;
	}
>();

export const definePlugin = createPlugin<PluginConfig>((_pluginConfig) => {
	return {
		name: pluginEnum.VueQuery,
		dependencies: [pluginEnum.TsType, pluginEnum.Request],
		hooks: {
			buildStart: async (ctx) => {
				// 可注入日志、校验 pluginConfig
				// ctx.logger.info('Request 插件启动', pluginConfig)
				stateMap.set(ctx.openapiToSingleConfig, {
					project: new Project(),
					pluginConfig: {
						infinite: {
							pageNumParam: "",
						},
						requestConfigTypeImportDeclaration: {
							namedImports: _pluginConfig?.responseErrorTypeImportDeclaration
								?.namedImports ?? ["AxiosRequestConfig"],
							moduleSpecifier:
								_pluginConfig?.responseErrorTypeImportDeclaration
									?.moduleSpecifier ?? "axios",
						},
						responseErrorTypeImportDeclaration: {
							namedImports: _pluginConfig?.responseErrorTypeImportDeclaration
								?.namedImports ?? ["AxiosError"],
							moduleSpecifier:
								_pluginConfig?.responseErrorTypeImportDeclaration
									?.moduleSpecifier ?? "axios",
						},
						importWithExtension: _pluginConfig?.importWithExtension ?? true,
						placeholderData: {
							value:
								_pluginConfig?.placeholderData?.value ?? "keepPreviousData",
							pathInclude: _pluginConfig?.placeholderData?.pathInclude ?? [],
						},
						dataReturnType: _pluginConfig?.dataReturnType || "",
					},
				});
			},
			operation: async (operation, ctx) => {
				const state = stateMap.get(ctx.openapiToSingleConfig);
				if (!state) {
					new Error("VueQuery plugin state not found");
					return;
				}
				const { project, pluginConfig } = state;
				const baseName = `use${upperFirst(operation.accessor.operationName)}`;
				const suffix =
					operation.method === HttpMethods.GET ? "query" : "mutation";
				const hookName = `${baseName}${upperFirst(suffix)}`;
				const filePath = path.join(
					ctx.openapiToSingleConfig.output.dir,
					kebabCase(operation.tagName),
					`${kebabCase(baseName)}.${suffix}.ts`,
				);
				const operationSourceFile = project.createSourceFile(filePath, "", {
					overwrite: true,
				});

				operationSourceFile.addStatements(
					buildImports(filePath, operation, pluginConfig),
				);

				if (operation.method === HttpMethods.GET) {
					operationSourceFile.addStatements(
						buildQueryGenericType(operation, pluginConfig),
					);
				} else {
					operationSourceFile.addStatements(buildTVariables(operation));
				}

				//key
				operationSourceFile.addStatements([
					buildQueryKey(operation, pluginConfig),
					buildQueryKeyType(operation),
				]);

				operationSourceFile.addFunction({
					kind: StructureKind.Function,
					isAsync: false,
					name: hookName,
					typeParameters: buildTypeParameters(operation),
					parameters: buildMethodParameters(operation, pluginConfig),
					returnType: undefined,
					isExported: true,
					docs: jsDocTemplateFromMethod(operation),
					statements: buildMethodBody(operation, pluginConfig),
				});

				ctx.setSourceFiles(
					[pluginEnum.VueQuery, operation.accessor.operationName],
					operationSourceFile,
				);
			},
			tagEnd: async (tagData, ctx) => {},
			buildEnd() {},
		},
	};
});
