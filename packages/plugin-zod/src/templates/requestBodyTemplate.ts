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
	// A Request Body Reference Object aliases the component. Schema Object
	// references, including siblings, must go through schemaTemplate instead.
	if ("$ref" in requestBody && requestBody.$ref) {
		const refSchemaName = getComponentRefExportName(requestBody.$ref);

		return createVariable(requestName, refSchemaName, []);
	}

	// An existing Media Type Object without a schema accepts any JSON value.
	const schema =
		"schema" in requestBody && requestBody.schema !== undefined
			? requestBody.schema
			: true;

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
