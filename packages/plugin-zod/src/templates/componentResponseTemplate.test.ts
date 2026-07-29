import type { Schema } from "@openapi-to/core";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { componentResponseTemplate } from "./componentResponseTemplate.ts";

function initializer(schema: Schema): string {
	const statement = componentResponseTemplate({ schema }, "ResponseValue");
	return String(statement.declarations[0]?.initializer);
}

describe("componentResponseTemplate", () => {
	it("preserves nullable object response semantics", () => {
		const expression = initializer({
			type: "object",
			nullable: true,
			properties: { id: { type: "string" } },
		});
		expect(expression).toContain(".nullable()");
		const schema = Function("z", `return (${expression});`)(z) as z.ZodType;
		expect(schema.safeParse(null).success).toBe(true);
		expect(schema.safeParse({ id: "value" }).success).toBe(true);
	});

	it("preserves composition on object responses", () => {
		const expression = initializer({
			type: "object",
			properties: { id: { type: "string" } },
			allOf: [
				{
					type: "object",
					properties: { extra: { type: "number" } },
					required: ["extra"],
				},
			],
		});
		expect(expression).toContain("z.intersection(");
	});
});
