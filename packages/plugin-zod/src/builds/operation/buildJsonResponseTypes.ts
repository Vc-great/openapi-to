import {
	classifyResponseStatusCodes,
	type OperationWrapper,
} from "@openapi-to/core";
import type { StatementStructures } from "ts-morph";
import {
	buildResponseUnionSchema,
	operationResponseTemplate,
} from "@/templates/operationResponseTemplate.ts";
import {
	getResponseErrorTypeName,
	getResponseStatusSchemaName,
	getResponseSuccessName,
} from "@/templates/operationTypeNameTemplate.ts";
import type { JsonResponseObject } from "@/types.ts";
import type { SchemaRenderOptions } from "@/templates/schemaTemplate.ts";

export function buildJsonResponseTypes(
	operation: OperationWrapper,
	options: SchemaRenderOptions = {},
): StatementStructures[] {
	const responseName = getResponseSuccessName(operation);

	const allStatusCodes =
		operation.accessor.operation.getResponseStatusCodes?.() ?? [];
	const { success: successCodes, error: errorCodes } =
		classifyResponseStatusCodes(allStatusCodes);

	const responseObjects: JsonResponseObject[] = [
		...successCodes,
		...errorCodes,
	].map((code) => {
		const rawResponse = operation.accessor.operation.schema.responses?.[code];
		const responseRef =
			rawResponse &&
			typeof rawResponse === "object" &&
			"$ref" in rawResponse &&
			typeof rawResponse.$ref === "string"
				? rawResponse.$ref
				: undefined;
		const rawMedia =
			rawResponse &&
			typeof rawResponse === "object" &&
			!("$ref" in rawResponse) &&
			rawResponse.content
				? Object.values(rawResponse.content)[0]
				: undefined;
		const converted =
			operation.accessor.operation.getResponseAsJSONSchema?.(code)?.[0] ??
			undefined;
		const hasRawSchema =
			typeof rawMedia === "object" && rawMedia !== null && "schema" in rawMedia;
		return {
			code,
			jsonSchema: responseRef
				? {
						description: "",
						label: code,
						schema: { $ref: responseRef },
						type: "object",
					}
				: hasRawSchema
					? {
							description:
								(rawResponse &&
									typeof rawResponse === "object" &&
									!("$ref" in rawResponse) &&
									rawResponse.description) ||
								converted?.description ||
								"",
							label: converted?.label ?? code,
							schema: rawMedia.schema,
							type: converted?.type ?? "object",
						}
					: converted,
		};
	});

	const namedResponses = responseObjects.map((response) => ({
		...response,
		name: getResponseStatusSchemaName(responseName, response.code),
	}));
	const responseTypes = namedResponses.map(({ name, ...response }) =>
		operationResponseTemplate(response, name, options),
	);

	const successNames = namedResponses
		.filter(({ code }) => successCodes.includes(code))
		.map(({ name }) => name);
	responseTypes.push(buildResponseUnionSchema(responseName, successNames));

	const errorNames = namedResponses
		.filter(({ code }) => errorCodes.includes(code))
		.map(({ name }) => name);
	if (errorNames.length > 0) {
		responseTypes.push(
			buildResponseUnionSchema(
				getResponseErrorTypeName(operation.accessor.operationName),
				errorNames,
			),
		);
	}

	return responseTypes;
}

// ---------------- Helper: 单个 Response 类型生成 ----------------
