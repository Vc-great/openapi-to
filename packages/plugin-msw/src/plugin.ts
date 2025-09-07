import path from "node:path";
import type { OpenapiToSingleConfig } from "@openapi-to/core";
import { createPlugin, pluginEnum } from "@openapi-to/core";
import { kebabCase } from "lodash-es";
import { Project, StructureKind } from "ts-morph";
import { buildEnabled } from "./builds/buildEnabled.ts";
import { buildImports } from "./builds/buildImports.ts";
import { buildMethodBody } from "./builds/buildMethodBody.ts";
import { buildMethodParameters } from "./builds/buildMethodParameters.ts";
import { jsDocTemplateFromMethod } from "./template/jsDocTemplateFromMethod.ts";
import type { PluginConfig, RequiredPluginConfig } from "./types.ts";

const stateMap = new WeakMap<
	OpenapiToSingleConfig,
	{
		project: Project;
		pluginConfig: RequiredPluginConfig;
	}
>();
export const definePlugin = createPlugin<PluginConfig>((_pluginConfig) => {
	return {
		dependencies: [
			...(_pluginConfig?.responseDefaultType === "faker" ? [] : []),
			pluginEnum.TsType,
		],
		name: pluginEnum.MSW,
		hooks: {
			buildStart: async (ctx) => {
				// 可注入日志、校验 pluginConfig
				// ctx.logger.info('Request 插件启动', pluginConfig)
				stateMap.set(ctx.openapiToSingleConfig, {
					project: new Project(),
					pluginConfig: {
						importWithExtension: _pluginConfig?.importWithExtension ?? true,
						responseDefaultType: _pluginConfig?.responseDefaultType || "",
					},
				});
			},
			tagStart: async (tagData, ctx) => {},
			operation: async (operation, ctx) => {
				const { project, pluginConfig } = stateMap.get(
					ctx.openapiToSingleConfig,
				)!;
				const requestName = `${operation.accessor.operationName}Handler`;

				const filePath = path.join(
					ctx.openapiToSingleConfig.output.dir,
					kebabCase(operation.tagName),
					`${kebabCase(operation.accessor.operationName)}.handler.ts`,
				);

				operation.accessor.setOperationRequest({
					filePath,
					requestName,
				});

				const operationSourceFile = project.createSourceFile(filePath, "", {
					overwrite: true,
				});

				operationSourceFile.addStatements(
					buildImports(operation, pluginConfig, filePath),
				);

				operationSourceFile.addStatements([buildEnabled()]);

				operationSourceFile.addFunction({
					kind: StructureKind.Function,
					isAsync: false,
					name: requestName,
					parameters: buildMethodParameters(operation, pluginConfig),
					returnType: undefined,
					isDefaultExport: true,
					docs: jsDocTemplateFromMethod(operation),
					statements: buildMethodBody(operation, pluginConfig),
				});

				ctx.setSourceFiles(
					[pluginEnum.MSW, operation.accessor.operationName],
					operationSourceFile,
				);
			},
			tagEnd: async (tagData, ctx) => {},
		},
	};
});
