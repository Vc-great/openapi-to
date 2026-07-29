import type { Schema } from "./types.ts";

type ParameterLike = {
	schema?: Schema;
	content?: Record<string, { schema?: Schema } | undefined>;
};

/**
 * Resolves the schema represented by a Parameter Object.
 *
 * OpenAPI permits either `schema` or `content`. Validation owns rejecting an
 * object that declares both; generation deterministically prefers `schema` as
 * a compatibility fallback. For `content`, the first declared Media Type is
 * used. A declared Media Type without `schema` accepts an unknown value.
 */
export function resolveParameterSchema(
	parameter: ParameterLike,
): Schema | undefined {
	if ("schema" in parameter && parameter.schema !== undefined) {
		return parameter.schema;
	}

	if ("content" in parameter && parameter.content) {
		const media = Object.values(parameter.content)[0];
		if (media) return media.schema === undefined ? true : media.schema;
	}

	return undefined;
}

export function isParameterRequired(parameter: {
	in?: string;
	required?: boolean;
}): boolean {
	return parameter.in === "path" || parameter.required === true;
}
