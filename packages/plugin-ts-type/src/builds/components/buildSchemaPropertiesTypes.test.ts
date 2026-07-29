import type { SchemaObject } from "oas/types";
import { describe, expect, it } from "vitest";
import { buildSchemaPropertiesTypes } from "./buildSchemaPropertiesTypes.ts";

describe("buildSchemaPropertiesTypes", () => {
	it("returns undefined when no properties or index signature are defined", () => {
		expect(
			buildSchemaPropertiesTypes({} as SchemaObject, "TestModel"),
		).toBeUndefined();
	});

	it("preserves required and optional properties", () => {
		const result = buildSchemaPropertiesTypes(
			{
				type: "object",
				required: ["id"],
				properties: {
					id: { type: "string" },
					name: { type: "string" },
				},
			},
			"TestModel",
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "id", type: "string" }),
				expect.objectContaining({ name: "name?", type: "string" }),
			]),
		);
	});

	it("preserves true and false boolean properties with optionality", () => {
		const result = buildSchemaPropertiesTypes(
			{
				type: "object",
				required: ["anything", "forbidden"],
				properties: {
					anything: true,
					forbidden: false,
					optionalAnything: true,
					optionalForbidden: false,
					name: { type: "string" },
				},
			} as unknown as SchemaObject,
			"Example",
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "anything", type: "unknown" }),
				expect.objectContaining({ name: "forbidden", type: "never" }),
				expect.objectContaining({
					name: "optionalAnything?",
					type: "unknown",
				}),
				expect.objectContaining({
					name: "optionalForbidden?",
					type: "never",
				}),
				expect.objectContaining({ name: "name?", type: "string" }),
			]),
		);
	});

	it.each([
		[true, "unknown"],
		[{ type: "number" }, "number"],
		[{ $ref: "#/components/schemas/Tag" }, "TagModel"],
		[{ type: "array", items: { type: "string" } }, "Array<string>"],
	] as const)(
		"uses the additionalProperties schema as the index value for %j",
		(additionalProperties, expected) => {
			const result = buildSchemaPropertiesTypes(
				{
					type: "object",
					additionalProperties,
				} as SchemaObject,
				"Example",
			);

			expect(result).toEqual([
				expect.objectContaining({ name: "[key: string]", type: expected }),
			]);
		},
	);

	it("does not emit an index signature for additionalProperties=false", () => {
		expect(
			buildSchemaPropertiesTypes(
				{ type: "object", additionalProperties: false },
				"Example",
			),
		).toBeUndefined();
	});

	it("widens a schema-valued index signature for incompatible fixed properties", () => {
		const result = buildSchemaPropertiesTypes(
			{
				type: "object",
				required: ["count"],
				properties: {
					count: { type: "number" },
					name: { type: "string" },
				},
				additionalProperties: { type: "number" },
			},
			"Example",
		);

		expect(result?.at(-1)).toMatchObject({
			name: "[key: string]",
			type: "number | string | undefined",
		});
	});
});
