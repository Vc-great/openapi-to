import type { ComponentsResponsesValue } from "@openapi-to/core";
import { StructureKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { buildComponentsResponse } from "./buildComponentsResponse.ts";

describe("buildComponentsResponse", () => {
	it("uses the real component response export for a Reference Object", () => {
		const response: ComponentsResponsesValue = {
			$ref: "#/components/responses/TestResponse",
		};

		expect(buildComponentsResponse(response, "TestResponse")).toMatchObject({
			kind: StructureKind.TypeAlias,
			name: "TestResponse",
			type: "ResponseTestResponse",
		});
	});

	it("renders a plain object response as an interface", () => {
		const response: ComponentsResponsesValue = {
			description: "Object",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: { id: { type: "string" } },
					},
				},
			},
		};

		expect(buildComponentsResponse(response, "TestResponse")).toMatchObject({
			kind: StructureKind.Interface,
			name: "TestResponse",
		});
	});

	it("maps empty content to undefined", () => {
		const response: ComponentsResponsesValue = {
			description: "No content",
			content: {},
		};

		expect(buildComponentsResponse(response, "TestResponse")).toMatchObject({
			kind: StructureKind.TypeAlias,
			name: "TestResponse",
			type: "undefined",
		});
	});
});
