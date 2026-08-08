import { componentResponseTemplate } from "@/templates/componentResponseTemplate.ts";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";
import type {
	InlineEnumSourcePath,
	InlineEnumSymbolResolver,
} from "@/utils/inlineEnumNaming.ts";
import {
	type ComponentsResponsesValue,
	describeResponse,
} from "@openapi-to/core";

export function buildComponentsResponse(
	response: ComponentsResponsesValue,
	responseName: string,
	inlineEnumSymbols?: InlineEnumSymbolResolver,
	inlineEnumSourcePath?: InlineEnumSourcePath,
) {
	if (response && "$ref" in response && response.$ref) {
		const typeName = getUpperFirstRefAlias(response.$ref);
		return createTypeAlias(responseName, typeName, []);
	}

	const descriptor = describeResponse(response);
	if (descriptor.kind === "no-content")
		return createTypeAlias(responseName, "undefined", []);
	if (descriptor.kind === "unknown-media")
		return createTypeAlias(responseName, "unknown", []);
	return componentResponseTemplate(
		{ schema: descriptor.schema },
		responseName,
		inlineEnumSymbols,
		inlineEnumSourcePath && descriptor.contentType
			? [...inlineEnumSourcePath, "content", descriptor.contentType, "schema"]
			: inlineEnumSourcePath,
	);
}
