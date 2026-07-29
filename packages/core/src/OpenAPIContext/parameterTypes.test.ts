import type {
	ComponentsParameterValue,
	ParameterObject,
	ParameterObjectWithRef,
} from "./types.ts";
import { describe, expect, it } from "vitest";

const openapi31TypeArrayParameter = {
	name: "filter",
	in: "query",
	schema: { type: ["string", "null"] },
} satisfies ComponentsParameterValue;

const openapi31BooleanParameter = {
	name: "deny",
	in: "query",
	schema: false,
} satisfies ParameterObject;

const openapi31ParameterWithRef = {
	name: "filter",
	in: "query",
	schema: { type: ["object", "null"] },
	$ref: "#/components/parameters/Base",
} satisfies ParameterObjectWithRef;

describe("OpenAPI 3.1 public Parameter Object types", () => {
	it("retain type arrays, boolean schemas, and resolved references", () => {
		expect(openapi31TypeArrayParameter.schema.type).toEqual(["string", "null"]);
		expect(openapi31BooleanParameter.schema).toBe(false);
		expect(openapi31ParameterWithRef.$ref).toBe(
			"#/components/parameters/Base",
		);
	});
});
