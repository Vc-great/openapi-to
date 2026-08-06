import type { ReferenceObject, RequestBodyObject } from "@openapi-to/core";
import { head, upperFirst } from "lodash-es";

import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { requestBodyTemplate } from "@/templates/requestBodyTemplate.ts";

import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";
import type {
	InlineEnumSourcePath,
	InlineEnumSymbolResolver,
} from "@/utils/inlineEnumNaming.ts";
import type {
	InterfaceDeclarationStructure,
	TypeAliasDeclarationStructure,
} from "ts-morph";

export function buildComponentsRequestBody(
	requestName: string,
	requestBody: ReferenceObject | RequestBodyObject,
	inlineEnumSymbols?: InlineEnumSymbolResolver,
	inlineEnumSourcePath?: InlineEnumSourcePath,
): InterfaceDeclarationStructure | TypeAliasDeclarationStructure | undefined {
	const name = `RequestBodies${upperFirst(requestName)}Model`;
	// 处理引用类型
	if (requestBody && "$ref" in requestBody && requestBody.$ref) {
		return createTypeAlias(name, getUpperFirstRefAlias(requestBody.$ref), []);
	}

	if ("content" in requestBody) {
		const content = head(Object.entries(requestBody.content));
		if (!content) {
			return undefined;
		}
		const [contentType, body] = content;

		return inlineEnumSymbols
			? requestBodyTemplate(
					name,
					body,
					inlineEnumSymbols,
					inlineEnumSourcePath
						? [...inlineEnumSourcePath, "content", contentType, "schema"]
						: undefined,
				)
			: requestBodyTemplate(name, body);
	}
}
