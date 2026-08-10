import type { ComponentsResponsesValue } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { buildComponentsResponse } from "./buildComponentsResponse.ts";

describe("buildComponentsResponse", () => {
	it("prefers JSON when a response component declares XML first", () => {
		const result = buildComponentsResponse(
			{
				description: "Multiple media",
				content: {
					"application/xml": { schema: { type: "string" } },
					"application/json": {
						schema: {
							type: "object",
							properties: { id: { type: "string" } },
						},
					},
				},
			} as ComponentsResponsesValue,
			"PreferredResponse",
		);

		expect(result.declarations[0]?.initializer).toBe(
			'z.looseObject({"id": z.string().optional()})',
		);
	});
});
