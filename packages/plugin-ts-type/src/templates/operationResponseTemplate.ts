import { buildSchemaPropertiesTypes } from "@/builds/components/buildSchemaPropertiesTypes.ts";
import { getResponseErrorTypeName } from "@/templates/operationTypeNameTemplate.ts";

import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import { canRenderAsPlainInterface } from "@/templates/canRenderAsPlainInterface.ts";
import type {
	InlineEnumSourcePath,
	InlineEnumSymbolResolver,
} from "@/utils/inlineEnumNaming.ts";
import { upperFirst } from "lodash-es";
import {
	type JSDocStructure,
	type OptionalKind,
	type StatementStructures,
	StructureKind,
	type TypeAliasDeclarationStructure,
} from "ts-morph";
import type { JsonResponseObject } from "../types.ts";

export function operationResponseTemplate(
	{ jsonSchema }: JsonResponseObject,
	declarationName: string,
	inlineEnumSymbols?: InlineEnumSymbolResolver,
	inlineEnumSourcePath?: InlineEnumSourcePath,
): StatementStructures {
	const schema = jsonSchema?.schema;

	const docs: OptionalKind<JSDocStructure>[] = jsonSchema?.description
		? [
				{
					tags: [
						{
							leadingTrivia: "\n",
							tagName: "description",
							text: jsonSchema.description,
						},
					],
				},
			]
		: [];

	if (schema === undefined) {
		return createTypeAlias(declarationName, "undefined", docs);
	}

	/*  if (schema?.$ref) {
    const refType = `${upperFirst(getRefAlias(schema.$ref))}Model`
    return createTypeAlias(typeName, refType, docs)
  }*/

	if (canRenderAsPlainInterface(schema)) {
		return {
			kind: StructureKind.Interface,
			name: declarationName,
			isExported: true,
			docs,
			properties:
				buildSchemaPropertiesTypes(
					schema as Parameters<typeof buildSchemaPropertiesTypes>[0],
					declarationName,
					inlineEnumSymbols,
					inlineEnumSourcePath,
				) ?? [],
		};
	}

	const baseName = `${declarationName}${upperFirst(jsonSchema?.label || "")}`;
	const aliasedType = schemaTemplate(
		schema,
		baseName,
		undefined,
		inlineEnumSymbols,
		inlineEnumSourcePath,
	);
	return createTypeAlias(declarationName, aliasedType, docs);
}

// ---------------- Helper: TypeAlias 构建 ----------------

export function createTypeAlias(
	name: string,
	type: string,
	docs?: OptionalKind<JSDocStructure>[],
): TypeAliasDeclarationStructure {
	return {
		kind: StructureKind.TypeAlias,
		name,
		isExported: true,
		type,
		docs,
	};
}

// ---------------- Helper: 错误类型联合 ----------------

export function buildResponseErrorType(
	operationName: string,
	memberNames: string[],
): TypeAliasDeclarationStructure {
	return {
		kind: StructureKind.TypeAlias,
		name: getResponseErrorTypeName(operationName),
		isExported: true,
		type: memberNames.length > 0 ? memberNames.join(" | ") : "unknown",
	};
}

export function buildResponseUnionType(
	name: string,
	memberNames: string[],
): TypeAliasDeclarationStructure {
	return {
		kind: StructureKind.TypeAlias,
		name,
		isExported: true,
		type: memberNames.length > 0 ? memberNames.join(" | ") : "unknown",
	};
}

// ---------------- Helper: 无成功响应时 fallback ----------------

export function buildDefaultSuccessType(
	name: string,
): TypeAliasDeclarationStructure {
	return {
		kind: StructureKind.TypeAlias,
		name,
		type: "unknown",
		isExported: true,
	};
}
