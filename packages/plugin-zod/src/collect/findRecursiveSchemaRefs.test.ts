import { describe, expect, it } from "vitest";
import { findRecursiveSchemaRefs } from "./findRecursiveSchemaRefs.ts";

describe("findRecursiveSchemaRefs", () => {
	it("marks self and mutual recursion but not ordinary reference chains", () => {
		const recursive = findRecursiveSchemaRefs({
			Leaf: { type: "object", properties: { value: { type: "string" } } },
			Wrapper: {
				type: "object",
				properties: { leaf: { $ref: "#/components/schemas/Leaf" } },
			},
			Node: {
				type: "object",
				properties: { next: { $ref: "#/components/schemas/Node" } },
			},
			Left: {
				type: "object",
				properties: { right: { $ref: "#/components/schemas/Right" } },
			},
			Right: {
				type: "object",
				properties: { left: { $ref: "#/components/schemas/Left" } },
			},
		});
		expect([...recursive].sort()).toEqual([
			"#/components/schemas/Left",
			"#/components/schemas/Node",
			"#/components/schemas/Right",
		]);
	});
});
