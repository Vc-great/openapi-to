import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateParameterSchema } from "./generateParameterSchema.ts";

function evaluate(
	parameters: unknown[],
	aliases: Record<string, z.ZodType> = {},
): z.ZodType {
	const names = Object.keys(aliases);
	return Function(
		"z",
		...names,
		`"use strict"; return (${generateParameterSchema(parameters as never, "testOperation")});`,
	)(z, ...names.map((name) => aliases[name])) as z.ZodType;
}

describe("generateParameterSchema", () => {
	it("applies the same required semantics to referenced and inline parameters", () => {
		const referencedOptionalQuerySchema = evaluate(
			[
				{
					$ref: "#/components/parameters/Search",
					name: "search",
					in: "query",
					schema: { type: "string" },
				},
			],
			{ ParameterSearchModel: z.string() },
		);
		const referencedRequiredQuerySchema = evaluate(
			[
				{
					$ref: "#/components/parameters/RequiredSearch",
					name: "search",
					in: "query",
					required: true,
					schema: { type: "string" },
				},
			],
			{ ParameterRequiredSearchModel: z.string() },
		);
		const referencedPathSchema = evaluate(
			[
				{
					$ref: "#/components/parameters/UserId",
					name: "id",
					in: "path",
					schema: { type: "string" },
				},
			],
			{ ParameterUserIdModel: z.string() },
		);

		expect(referencedOptionalQuerySchema.safeParse({}).success).toBe(true);
		expect(
			referencedOptionalQuerySchema.safeParse({ search: "abc" }).success,
		).toBe(true);
		expect(referencedRequiredQuerySchema.safeParse({}).success).toBe(false);
		expect(referencedPathSchema.safeParse({}).success).toBe(false);
	});

	it("preserves boolean and empty parameter schemas at runtime", () => {
		expect(
			evaluate([
				{ name: "allow", in: "query", required: true, schema: true },
			]).safeParse({ allow: null }).success,
		).toBe(true);
		expect(
			evaluate([
				{ name: "anything", in: "query", required: true, schema: {} },
			]).safeParse({ anything: { any: "value" } }).success,
		).toBe(true);
		expect(
			evaluate([
				{ name: "deny", in: "query", required: true, schema: false },
			]).safeParse({ deny: "value" }).success,
		).toBe(false);
	});
});
