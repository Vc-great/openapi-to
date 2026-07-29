import { describe, expect, it } from "vitest";
import {
	collectRefsFromComponentParameters,
	collectRefsFromComponentResponse,
	collectRefsFromOperationParameter,
} from "./collectRefsFromDocument.ts";

describe("collectRefsFromComponentResponse", () => {
	it("collects body schema refs without treating response header refs as body imports", () => {
		expect(
			collectRefsFromComponentResponse({
				description: "Success",
				headers: {
					"X-Request-Id": {
						$ref: "#/components/headers/RequestId",
					},
				},
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/Message" },
					},
				},
			} as never),
		).toEqual(["#/components/schemas/Message"]);
	});
});

describe("parameter reference collection", () => {
	it("collects nested refs from operation and component Parameter Object content", () => {
		const parameter = {
			name: "filter",
			in: "header",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							value: { $ref: "#/components/schemas/Filter" },
						},
					},
				},
			},
		};

		expect(collectRefsFromOperationParameter([parameter] as never)).toEqual([
			"#/components/schemas/Filter",
		]);
		expect(
			collectRefsFromComponentParameters({ Filter: parameter } as never),
		).toEqual(["#/components/schemas/Filter"]);
	});
});
