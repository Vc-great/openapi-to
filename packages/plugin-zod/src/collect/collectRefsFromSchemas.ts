import type { ComponentsSchema } from "@openapi-to/core";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function collectRefsFromSchema(schema: ComponentsSchema): string[] {
	const refs = new Set<string>();

	function walk(value: unknown): void {
		if (!isRecord(value)) return;

		if (typeof value.$ref === "string") {
			refs.add(value.$ref);
		}

		if (isRecord(value.properties)) {
			Object.values(value.properties).forEach((property) => {
				walk(property);
			});
		}

		if (Array.isArray(value.items)) {
			value.items.forEach((item) => {
				walk(item);
			});
		} else {
			walk(value.items);
		}

		for (const key of ["allOf", "anyOf", "oneOf"] as const) {
			const composed = value[key];
			if (Array.isArray(composed)) {
				composed.forEach((member) => {
					walk(member);
				});
			}
		}

		walk(value.not);
		walk(value.additionalProperties);
	}

	walk(schema);
	return [...refs];
}
