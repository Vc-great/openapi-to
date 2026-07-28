import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renderObjectSchema, schemaTemplate } from "./schemaTemplate.ts";

function evaluate(schema: unknown) {
	return Function(
		"z",
		`"use strict"; return (${schemaTemplate(schema as never)});`,
	)(z) as z.ZodType;
}

describe("schemaTemplate Zod 4 output", () => {
	it.each([
		[{ type: "string", format: "email" }, "z.email()"],
		[{ type: "string", format: "uri" }, "z.url()"],
		[{ type: "string", format: "url" }, "z.url()"],
		[{ type: "string", format: "uuid" }, "z.uuid()"],
		[{ type: "string", format: "date" }, "z.iso.date()"],
		[{ type: "string", format: "date-time" }, "z.iso.datetime()"],
		[{ type: "string", format: "datetime" }, "z.iso.datetime()"],
		[{ type: "string", format: "byte" }, "z.base64()"],
		[{ type: "string", format: "binary" }, "z.string()"],
	])("renders %j as %s", (schema, expected) => {
		expect(schemaTemplate(schema as never)).toBe(expected);
	});

	it("preserves string constraints on top-level formats", () => {
		expect(
			schemaTemplate({
				type: "string",
				format: "email",
				minLength: 3,
				maxLength: 40,
				pattern: ".+@.+",
			} as never),
		).toBe('z.email().min(3).max(40).regex(new RegExp(".+@.+"))');
	});

	it("renders string, numeric, boolean, mixed, single and escaped enums", () => {
		expect(schemaTemplate({ enum: ["a", "b"] } as never)).toBe(
			'z.enum(["a", "b"])',
		);
		expect(schemaTemplate({ enum: [1, 2] } as never)).toBe(
			"z.union([z.literal(1), z.literal(2)])",
		);
		expect(schemaTemplate({ enum: [true, false] } as never)).toBe(
			"z.union([z.literal(true), z.literal(false)])",
		);
		expect(schemaTemplate({ enum: ["a", 2, false] } as never)).toBe(
			'z.union([z.literal("a"), z.literal(2), z.literal(false)])',
		);
		expect(schemaTemplate({ enum: ["single"] } as never)).toBe(
			'z.literal("single")',
		);
		expect(schemaTemplate({ enum: ['quote"', "slash\\\n"] } as never)).toBe(
			'z.enum(["quote\\"", "slash\\\\\\n"])',
		);
	});

	it("diagnoses empty enums and compositions without emitting broken code", () => {
		const diagnostics: string[] = [];
		expect(
			schemaTemplate({ enum: [] } as never, "", "", {
				onDiagnostic: ({ code }) => diagnostics.push(code),
			}),
		).toBe("z.never()");
		expect(
			schemaTemplate({ oneOf: [] } as never, "", "", {
				onDiagnostic: ({ code }) => diagnostics.push(code),
			}),
		).toBe("z.never()");
		expect(
			schemaTemplate({ allOf: [] } as never, "", "", {
				onDiagnostic: ({ code }) => diagnostics.push(code),
			}),
		).toBe("z.never()");
		expect(diagnostics).toEqual([
			"ZOD_EMPTY_ENUM",
			"ZOD_EMPTY_COMPOSITION",
			"ZOD_EMPTY_COMPOSITION",
		]);
		expect(() => schemaTemplate({ oneOf: [] } as never)).toThrow(
			/ZOD_EMPTY_COMPOSITION/,
		);
		expect(() =>
			schemaTemplate({ enum: [{ unsupported: true }] } as never),
		).toThrow(/ZOD_UNSUPPORTED_ENUM_VALUE/);
	});

	it("renders executable unions and nested intersections with stable single-member output", () => {
		expect(
			schemaTemplate({
				oneOf: [{ type: "string" }, { type: "number" }],
			} as never),
		).toBe("z.union([z.string(), z.number()])");
		expect(schemaTemplate({ anyOf: [{ type: "boolean" }] } as never)).toBe(
			"z.boolean()",
		);
		expect(
			schemaTemplate({
				allOf: [
					{
						type: "object",
						properties: { a: { type: "string" } },
						required: ["a"],
					},
					{
						type: "object",
						properties: { b: { type: "number" } },
						required: ["b"],
					},
					{
						type: "object",
						properties: { c: { type: "boolean" } },
						required: ["c"],
					},
				],
			} as never),
		).toBe(
			'z.intersection(z.intersection(z.looseObject({"a": z.string()}), z.looseObject({"b": z.number()})), z.looseObject({"c": z.boolean()}))',
		);
	});

	it("uses two-argument records and models additionalProperties policies", () => {
		expect(
			renderObjectSchema({
				type: "object",
				additionalProperties: { type: "integer" },
			}),
		).toBe("z.record(z.string(), z.int())");
		expect(
			renderObjectSchema({ type: "object", additionalProperties: true }),
		).toBe("z.looseObject({})");
		expect(
			renderObjectSchema({ type: "object", additionalProperties: false }),
		).toBe("z.strictObject({})");
		expect(
			renderObjectSchema({
				type: "object",
				properties: { fixed: { type: "string" } },
				required: ["fixed"],
				additionalProperties: { enum: [1, 2] },
			}),
		).toBe(
			'z.object({"fixed": z.string()}).catchall(z.union([z.literal(1), z.literal(2)]))',
		);
		expect(
			schemaTemplate({
				type: "object",
				additionalProperties: { $ref: "#/components/schemas/Value" },
			} as never),
		).toBe("z.record(z.string(), valueSchema)");
	});

	it("quotes unsafe property names and preserves required, optional and nullable behavior", () => {
		const expression = renderObjectSchema({
			type: "object",
			required: ["user-id", "default", "1name"],
			additionalProperties: false,
			properties: {
				"user-id": { type: "string" },
				"content/type": { type: "string" },
				default: { type: "number" },
				"has space": { type: "boolean" },
				"single'quote": { type: "string" },
				'double"quote': { type: "string" },
				"back\\slash": { type: "string" },
				"1name": { type: "string", nullable: true },
			},
		});
		expect(expression).toContain('"user-id": z.string()');
		expect(expression).toContain('"content/type": z.string().optional()');
		expect(expression).toContain('"double\\"quote": z.string().optional()');
		expect(expression).toContain('"back\\\\slash": z.string().optional()');
		expect(expression).toContain('"1name": z.string().nullable()');
		const parsed = Function("z", `return (${expression});`)(z) as z.ZodType;
		expect(
			parsed.safeParse({ "user-id": "u", default: 1, "1name": null }).success,
		).toBe(true);
		expect(
			parsed.safeParse({
				"user-id": "u",
				default: 1,
				"1name": "x",
				extra: true,
			}).success,
		).toBe(false);
	});

	it("parses representative Zod 4 values at runtime", () => {
		const schema = evaluate({
			type: "object",
			required: [
				"email",
				"url",
				"uuid",
				"date",
				"dateTime",
				"bytes",
				"count",
				"choice",
				"items",
				"nested",
				"metadata",
			],
			additionalProperties: false,
			properties: {
				email: { type: "string", format: "email" },
				url: { type: "string", format: "uri" },
				uuid: { type: "string", format: "uuid" },
				date: { type: "string", format: "date" },
				dateTime: { type: "string", format: "date-time" },
				bytes: { type: "string", format: "byte" },
				count: { type: "integer", minimum: 1, maximum: 3 },
				choice: { enum: ["a", 2] },
				items: { type: "array", items: { enum: ["x", "y"] }, minItems: 1 },
				nested: {
					type: "object",
					required: ["ok"],
					properties: { ok: { type: "boolean" } },
				},
				metadata: { type: "object", additionalProperties: { type: "string" } },
				nullable: { type: "string", nullable: true },
			},
		});
		const valid = {
			email: "user@example.com",
			url: "https://example.com/a",
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			date: "2026-07-28",
			dateTime: "2026-07-28T12:30:00Z",
			bytes: "aGVsbG8=",
			count: 2,
			choice: 2,
			items: ["x"],
			nested: { ok: true },
			metadata: { owner: "codex" },
			nullable: null,
		};
		expect(schema.parse(valid)).toEqual(valid);
		expect(schema.safeParse({ ...valid, email: "invalid" }).success).toBe(
			false,
		);
		expect(schema.safeParse({ ...valid, count: 2.5 }).success).toBe(false);
		expect(schema.safeParse({ ...valid, bytes: "not base64!" }).success).toBe(
			false,
		);
	});
});
