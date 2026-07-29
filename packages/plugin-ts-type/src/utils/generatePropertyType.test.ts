import { describe, expect, it } from "vitest";
import { generateParameterType } from "./generatePropertyType.ts";

describe("generateParameterType", () => {
	it("uses Parameter Object content and enforces path requiredness", () => {
		expect(
			generateParameterType(
				[
					{
						name: "filter",
						in: "query",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { status: { type: "string" } },
								},
							},
						},
					},
					{
						name: "id",
						in: "path",
						required: false,
						schema: { type: "string" },
					},
				] as never,
				"search",
			),
		).toContain("filter?: {");
		expect(
			generateParameterType(
				[
					{
						name: "id",
						in: "path",
						required: false,
						schema: { type: "string" },
					},
				] as never,
				"search",
			),
		).toContain("id: string");
	});
});
