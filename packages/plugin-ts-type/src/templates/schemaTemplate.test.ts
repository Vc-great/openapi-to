import type { Schema } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { schemaTemplate } from "./schemaTemplate";

describe("schemaTemplate", () => {
	/*  it('should return "unknown" for undefined schema', () => {
    expect(schemaTemplate(undefined, 'testProperty')).toBe('unknown')
  })*/

	it("should handle $ref schema", () => {
		const schema: Schema = { $ref: "#/components/schemas/TestRef" };
		expect(schemaTemplate(schema, "testProperty")).toBe("TestRefModel");
	});

	it("preserves nullable and composition siblings beside $ref", () => {
		expect(
			schemaTemplate(
				{
					$ref: "#/components/schemas/TestRef",
					nullable: true,
				},
				"testProperty",
			),
		).toBe("TestRefModel | null");
		expect(
			schemaTemplate(
				{
					$ref: "#/components/schemas/TestRef",
					anyOf: [{ type: "string" }],
				},
				"testProperty",
			),
		).toBe("TestRefModel & string");
		expect(
			schemaTemplate(
				{
					$ref: "#/components/schemas/TestRef",
					oneOf: [{ type: "string" }, { type: "number" }],
				},
				"testProperty",
			),
		).toBe("TestRefModel & (string | number)");
		expect(
			schemaTemplate(
				{
					$ref: "#/components/schemas/TestRef",
					allOf: [{ $ref: "#/components/schemas/Extra" }],
				},
				"testProperty",
			),
		).toBe("TestRefModel & ExtraModel");
		expect(
			schemaTemplate(
				{
					$ref: "#/components/schemas/TestRef",
					anyOf: [{ $ref: "#/components/schemas/Extra" }],
					nullable: true,
				},
				"testProperty",
			),
		).toBe("(TestRefModel & ExtraModel) | null");
	});

	it("should handle enum schema", () => {
		const schema: Schema = { type: "string", enum: ["value1", "value2"] };
		expect(schemaTemplate(schema, "testProperty")).toBe(
			"TestPropertyEnumValue",
		);
	});

	it("should handle oneOf schema", () => {
		const schema: Schema = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};
		expect(schemaTemplate(schema, "testProperty")).toBe("string | number");
	});

	it("should handle allOf schema", () => {
		const schema: Schema = {
			allOf: [{ type: "string" }, { type: "number" }],
		};
		expect(schemaTemplate(schema, "testProperty")).toBe("string & number");
	});

	it("should handle nullable schema", () => {
		const schema: Schema = { type: "string", nullable: true };
		expect(schemaTemplate(schema, "testProperty")).toBe("string | null");
	});

	it("should handle array schema", () => {
		const schema: Schema = { type: "array", items: { type: "string" } };
		expect(schemaTemplate(schema, "testProperty")).toBe("Array<string>");
	});

	it("should handle object schema with properties", () => {
		const schema: Schema = {
			type: "object",
			properties: {
				key1: { type: "string" },
				key2: { type: "number" },
			},
		};
		expect(schemaTemplate(schema, "testProperty")).toBe(`{
    key1?: string;
    key2?: number;
}`);
	});

	it("should handle object schema without properties", () => {
		const schema: Schema = { type: "object" };
		expect(schemaTemplate(schema, "testProperty")).toBe(
			"Record<string, unknown>",
		);
	});

	it('should return "unknown" for unsupported types', () => {
		const schema = { type: "unsupportedType" } as unknown as Schema;
		expect(schemaTemplate(schema, "testProperty")).toBe("unknown");
	});
});
