import type { MediaTypeObject, ReferenceObject } from "@openapi-to/core";
import {
	type JSDocStructure,
	type OptionalKind,
	StructureKind,
	VariableDeclarationKind,
	type VariableStatementStructure,
} from "ts-morph";
import { jsDocTemplateFromSchema } from "@/templates/jsDocTemplateFromSchema.ts";
import {
	schemaTemplate,
	type SchemaRenderOptions,
} from "@/templates/schemaTemplate.ts";
import { getComponentRefExportName } from "@/utils/componentNaming.ts";

type RequestBody = MediaTypeObject | ReferenceObject;

export function requestBodyTemplate(
	requestName: string,
	requestBody: RequestBody,
	options: SchemaRenderOptions = {},
): VariableStatementStructure | undefined {
	const schema = "schema" in requestBody && requestBody.schema;
	const $ref =
		"$ref" in requestBody
			? requestBody.$ref
			: schema && typeof schema === "object" && "$ref" in schema && schema.$ref;

	// 处理引用类型
	if ($ref) {
		const refSchemaName = getComponentRefExportName($ref);

		return createVariable(requestName, refSchemaName, []);
	}
	if (schema === undefined) {
		return undefined;
	}

	// 创建文档注释
	const docs: OptionalKind<JSDocStructure>[] = jsDocTemplateFromSchema(
		(typeof schema === "object" &&
			schema !== null &&
			"description" in schema &&
			schema.description) ||
			"",
		schema,
	);

	// 处理数组类型
	if (
		typeof schema === "object" &&
		schema !== null &&
		!("$ref" in schema) &&
		schema.type === "array"
	) {
		const type = schemaTemplate(schema, requestName, "", options);
		return createVariable(requestName, type, docs);
	}

	return createVariable(
		requestName,
		schemaTemplate(schema, requestName, "", options),
		docs,
	);
}

export function createVariable(
	name: string,
	initializer: string,
	docs?: OptionalKind<JSDocStructure>[],
): VariableStatementStructure {
	return {
		kind: StructureKind.VariableStatement,
		declarationKind: VariableDeclarationKind.Const,
		isExported: true,
		docs,
		declarations: [
			{
				name,
				initializer,
			},
		],
	};
}
