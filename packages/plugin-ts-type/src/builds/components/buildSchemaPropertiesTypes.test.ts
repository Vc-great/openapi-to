import * as jsDocTemplateModule from "@/templates/jsDocTemplateFromSchema";
import * as schemaTemplateModule from "@/templates/schemaTemplate";
import type { SchemaObject } from "oas/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSchemaPropertiesTypes } from "./buildSchemaPropertiesTypes";

vi.mock("@/templates/schemaTemplate.ts");
vi.mock("@/templates/jsDocTemplateFromSchema.ts");

describe("buildSchemaPropertiesTypes", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(schemaTemplateModule.schemaTemplate).mockImplementation((schema) => {
			if (typeof schema === "object" && schema !== null) {
				if ("$ref" in schema && typeof schema.$ref === "string") {
					return `${schema.$ref.split("/").at(-1)}Model`;
				}
				if ("type" in schema && typeof schema.type === "string")
					return schema.type;
			}
			return "unknown";
		});
		vi.mocked(jsDocTemplateModule.jsDocTemplateFromSchema).mockReturnValue([
			{ description: "jsdoc" },
		]);
	});

	it("should return undefined when no properties are defined", () => {
		expect(
			buildSchemaPropertiesTypes({} as SchemaObject, "TestModel"),
		).toBeUndefined();
	});

	it("should generate property signatures for each property", () => {
		const schema: SchemaObject = {
			properties: {
				name: { type: "string", description: "User name" },
				age: { type: "number", description: "User age" },
			},
		};

		const result = buildSchemaPropertiesTypes(schema, "TestModel");
		expect(result).toHaveLength(2);
		expect(result?.[0]).toMatchObject({
			name: "name?",
			type: "string",
			docs: [{ description: "jsdoc" }],
		});
		expect(result?.[1]).toMatchObject({
			name: "age?",
			type: "number",
			docs: [{ description: "jsdoc" }],
		});
	});

	it("should mark required properties correctly", () => {
		const schema: SchemaObject = {
			properties: {
				id: { type: "string" },
				name: { type: "string" },
			},
			required: ["id"],
		};

		const result = buildSchemaPropertiesTypes(schema, "TestModel");
		expect(result?.[0]?.name).toBe("id");
		expect(result?.[1]?.name).toBe("name?");
	});

	it("should handle referenced properties", () => {
		const schema: SchemaObject = {
			properties: {
				user: { $ref: "#/components/schemas/User" },
			},
		};

		const result = buildSchemaPropertiesTypes(schema, "TestModel");
		expect(result?.[0]?.type).toBe("UserModel");
		expect(result?.[0]?.name).toBe("user?");
	});

	it("should add index signature for additionalProperties=true", () => {
		const schema: SchemaObject = {
			properties: {
				name: { type: "string" },
			},
			additionalProperties: true,
		};

		const result = buildSchemaPropertiesTypes(schema, "TestModel");
		expect(result).toHaveLength(2);
		expect(result?.[1]?.name).toBe("[key: string]");
		expect(result?.[1]?.type).toBe("Record<string, unknown>");
	});

	it("should add index signature for additionalProperties schema object", () => {
		const schema: SchemaObject = {
			properties: {
				name: { type: "string" },
			},
			additionalProperties: { type: "number" },
		};

		const result = buildSchemaPropertiesTypes(schema, "TestModel");
		expect(result).toHaveLength(2);
		expect(result?.[1]?.name).toBe("[key: string]");
		expect(result?.[1]?.type).toBe("Record<string, number>");
	});

	it("should add index signature for referenced additionalProperties", () => {
		const schema: SchemaObject = {
			properties: {
				name: { type: "string" },
			},
			additionalProperties: { $ref: "#/components/schemas/Tag" },
		};

		const result = buildSchemaPropertiesTypes(schema, "TestModel");
		expect(result).toHaveLength(2);
		expect(result?.[1]?.name).toBe("[key: string]");
		expect(result?.[1]?.type).toBe("Record<string, TagModel>");
	});
});
