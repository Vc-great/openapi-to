import type { OperationWrapper } from "@openapi-to/core";
import {
	formatterModuleSpecifier,
	getRelativePath,
} from "@openapi-to/core/utils";

import { type ImportDeclarationStructure, StructureKind } from "ts-morph";
import type { PluginConfig } from "../types.ts";

export function buildImports(
	operation: OperationWrapper,
	pluginConfig: PluginConfig,
	filePath: string,
): Array<ImportDeclarationStructure> {
	const msw: ImportDeclarationStructure = {
		kind: StructureKind.ImportDeclaration,
		namedImports: ["http", "HttpResponse"],
		moduleSpecifier: "msw",
	};

	const responseSuccess: ImportDeclarationStructure = {
		kind: StructureKind.ImportDeclaration,
		isTypeOnly: true,
		namedImports: [
			operation.accessor.operationTSType?.responseSuccess || "never",
		],
		moduleSpecifier: formatterModuleSpecifier(
			getRelativePath(
				filePath,
				operation.accessor.operationTSType?.filePath || "",
			),
			pluginConfig?.importWithExtension,
		),
	};

	const fakerResponse = operation.accessor.operationFaker;
	const shouldIncludeFakerImport =
		pluginConfig.responseDefaultType === "faker" &&
		fakerResponse?.filePath &&
		fakerResponse?.responseSuccess;

	const fakerResponseSuccess: ImportDeclarationStructure | null = shouldIncludeFakerImport
		? {
				kind: StructureKind.ImportDeclaration,
				namedImports: [fakerResponse.responseSuccess],
				moduleSpecifier: formatterModuleSpecifier(
					getRelativePath(filePath, fakerResponse.filePath),
					pluginConfig?.importWithExtension,
				),
		  }
		: null;

	return [
		responseSuccess,
		msw,
		...(fakerResponseSuccess ? [fakerResponseSuccess] : []),
	] as Array<ImportDeclarationStructure>;
}
