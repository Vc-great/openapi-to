import { describe, expect, it } from "vitest";
import { InlineEnumSymbolAllocator } from "./inlineEnumNaming.ts";
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

	it("renders operation parameter enum references from source-path allocations", () => {
		const operationSourcePath = ["paths", "/search", "get"] as const;
		const parameters = [
			{
				name: "similarName",
				in: "query",
				schema: { type: "string", enum: ["lower"] },
			},
			{
				name: "SimilarName",
				in: "query",
				schema: { type: "string", enum: ["upper"] },
			},
		] as const;
		const sources = parameters.map((parameter) => ({
			name: "searchSimilarName",
			sourcePath: [
				...operationSourcePath,
				"parameters",
				parameter.in,
				parameter.name,
				"schema",
			],
		}));
		const allocator = new InlineEnumSymbolAllocator(sources);
		const output = generateParameterType(
			parameters as never,
			"search",
			allocator,
			operationSourcePath,
		);

		for (const source of sources) {
			expect(output).toContain(
				allocator.getTypeName(source.sourcePath, "SearchSimilarNameEnumValue"),
			);
		}
	});
});
