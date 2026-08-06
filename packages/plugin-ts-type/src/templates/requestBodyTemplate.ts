import type { MediaTypeObject, ReferenceObject } from "@openapi-to/core";

import { buildSchemaPropertiesTypes } from "@/builds/components/buildSchemaPropertiesTypes.ts";
import { schemaTemplate } from "@/templates/schemaTemplate.ts";
import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";
import type {
	InlineEnumSourcePath,
	InlineEnumSymbolResolver,
} from "@/utils/inlineEnumNaming.ts";
import { isBoolean, isEmpty } from "lodash-es";

import {
	type InterfaceDeclarationStructure,
	type JSDocStructure,
	type OptionalKind,
	StructureKind,
	type TypeAliasDeclarationStructure,
} from "ts-morph";

type RequestBody = MediaTypeObject | ReferenceObject;

export function requestBodyTemplate(
	requestName: string,
	requestBody: RequestBody,
	inlineEnumSymbols?: InlineEnumSymbolResolver,
	inlineEnumSourcePath?: InlineEnumSourcePath,
): InterfaceDeclarationStructure | TypeAliasDeclarationStructure | undefined {
	if ("$ref" in requestBody && requestBody.$ref) {
		const refType = getUpperFirstRefAlias(requestBody.$ref);
		return createTypeAlias(requestName, refType, []);
	}
	const schema = "schema" in requestBody ? requestBody.schema : undefined;
	if (schema === undefined) {
		return createTypeAlias(requestName, "unknown", []);
	}
	if (isBoolean(schema) || isEmpty(schema)) {
		return createTypeAlias(
			requestName,
			schemaTemplate(
				schema,
				requestName,
				undefined,
				inlineEnumSymbols,
				inlineEnumSourcePath,
			),
			[],
		);
	}

	// 创建文档注释
	const docs: OptionalKind<JSDocStructure>[] =
		!("$ref" in schema) && schema.description
			? [{ tags: [{ tagName: "description", text: schema.description }] }]
			: [];

	// 处理数组类型
	if (!("$ref" in schema) && schema.type === "array") {
		const type = schemaTemplate(
			schema,
			requestName,
			undefined,
			inlineEnumSymbols,
			inlineEnumSourcePath,
		);
		return createTypeAlias(requestName, type, docs);
	}

	// 处理二进制文件类型
	if (
		!("$ref" in schema) &&
		schema.type === "string" &&
		schema.format === "binary"
	) {
		return createTypeAlias(requestName, "Blob", docs);
	}

	if (
		!("$ref" in schema) &&
		!schema.oneOf &&
		!schema.anyOf &&
		!schema.allOf &&
		(!("nullable" in schema) || schema.nullable !== true) &&
		schema.type === "object" &&
		schema.properties
	) {
		return {
			kind: StructureKind.Interface,
			name: requestName,
			isExported: true,
			docs,
			properties:
				buildSchemaPropertiesTypes(
					schema,
					requestName,
					inlineEnumSymbols,
					inlineEnumSourcePath,
				) || [],
		};
	}

	return createTypeAlias(
		requestName,
		schemaTemplate(
			schema,
			requestName,
			undefined,
			inlineEnumSymbols,
			inlineEnumSourcePath,
		),
		docs,
	);
}

function createTypeAlias(
	name: string,
	type: string,
	docs?: OptionalKind<JSDocStructure>[],
): TypeAliasDeclarationStructure {
	return {
		kind: StructureKind.TypeAlias,
		name,
		type,
		isExported: true,
		docs,
	};
}
