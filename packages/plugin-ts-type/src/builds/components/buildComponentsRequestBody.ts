import type { ReferenceObject, RequestBodyObject } from "@openapi-to/core";
import { head, upperFirst, values } from "lodash-es";

import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { requestBodyTemplate } from "@/templates/requestBodyTemplate.ts";

import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";
import type {
	InterfaceDeclarationStructure,
	TypeAliasDeclarationStructure,
} from "ts-morph";

export function buildComponentsRequestBody(
	requestName: string,
	requestBody: ReferenceObject | RequestBodyObject,
): InterfaceDeclarationStructure | TypeAliasDeclarationStructure | undefined {
	const name = `RequestBodies${upperFirst(requestName)}Model`;
	// 处理引用类型
	if (requestBody && "$ref" in requestBody && requestBody.$ref) {
		return createTypeAlias(name, getUpperFirstRefAlias(requestBody.$ref), []);
	}

	if ("content" in requestBody) {
		const body = head(values(requestBody.content));
		if (!body) {
			return undefined;
		}

		return requestBodyTemplate(name, body);
	}
}
