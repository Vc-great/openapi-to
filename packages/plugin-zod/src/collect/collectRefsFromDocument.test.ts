import { describe, expect, it } from "vitest";
import { collectRefsFromComponentResponse } from "./collectRefsFromDocument.ts";

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
