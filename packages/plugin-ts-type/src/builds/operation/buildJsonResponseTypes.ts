import {
	describeOperationResponses,
	type OperationWrapper,
} from "@openapi-to/core";
import type { StatementStructures } from "ts-morph";
import {
	buildDefaultSuccessType,
	buildResponseErrorType,
	buildResponseUnionType,
	operationResponseTemplate,
} from "@/templates/operationResponseTemplate.ts";
import {
	getResponseStatusTypeName,
	getResponseSuccessName,
} from "@/templates/operationTypeNameTemplate.ts";
import type { JsonResponseObject } from "@/types.ts";

export function buildJsonResponseTypes(
	operation: OperationWrapper,
): StatementStructures[] {
	const responseName = getResponseSuccessName(operation);

	const descriptors = describeOperationResponses(operation.accessor.operation);
	const responseObjects: JsonResponseObject[] = descriptors.map(
		(descriptor) => ({
			code: descriptor.statusCode,
			jsonSchema:
				descriptor.kind === "no-content"
					? undefined
					: {
							description: descriptor.description,
							label: descriptor.label ?? descriptor.statusCode,
							schema: descriptor.schema ?? true,
							type: descriptor.type ?? "object",
						},
		}),
	);
	const namedResponses = responseObjects.map((response) => ({
		...response,
		name: getResponseStatusTypeName(responseName, response.code),
	}));
	const responseTypes = namedResponses.map(({ name, ...response }) =>
		operationResponseTemplate(response, name),
	);

	responseTypes.push(
		buildResponseErrorType(
			operation.accessor.operationName,
			namedResponses
				.filter(({ code }) =>
					descriptors.some(
						(descriptor) =>
							descriptor.statusCode === code &&
							descriptor.classification === "error",
					),
				)
				.map(({ name }) => name),
		),
	);

	const successNames = namedResponses
		.filter(({ code }) =>
			descriptors.some(
				(descriptor) =>
					descriptor.statusCode === code &&
					descriptor.classification === "success",
			),
		)
		.map(({ name }) => name);
	if (successNames.length > 0) {
		responseTypes.push(buildResponseUnionType(responseName, successNames));
	} else {
		responseTypes.push(buildDefaultSuccessType(responseName));
	}

	return responseTypes;
}
