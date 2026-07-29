import type { ComponentsResponsesValue } from "@openapi-to/core";
import { head, values } from "lodash-es";
import { componentResponseTemplate } from "@/templates/componentResponseTemplate.ts";
import { createVariable } from "@/templates/operationResponseTemplate.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";
import {
	getComponentExportName,
	getComponentRefExportName,
} from "@/utils/componentNaming.ts";

export function buildComponentsResponse(
	response: ComponentsResponsesValue,
	responseName: string,
	options: SchemaRenderOptions = {},
) {
	const exportName = getComponentExportName("responses", responseName);
	if (response && "$ref" in response && response.$ref) {
		const typeName = getComponentRefExportName(response.$ref);
		return createVariable(exportName, typeName, []);
	}

	if (response && "content" in response && response.content) {
		const responseObject = head(values(response.content));
		if (!responseObject) {
			return;
		}
		return componentResponseTemplate(responseObject, exportName, options);
	}
}
