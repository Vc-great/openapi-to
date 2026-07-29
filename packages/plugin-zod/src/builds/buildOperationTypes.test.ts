import { describe, expect, it } from "vitest";
import { buildOperationTypes } from "./buildOperationTypes.ts";

describe("buildOperationTypes request parameters", () => {
	it("emits stable header and cookie schemas with required semantics", () => {
		const statements = buildOperationTypes({
			accessor: {
				operationName: "getUser",
				pathParameters: [],
				queryParameters: [],
				headerParameters: [
					{ name: "X-Optional", in: "header", schema: { type: "string" } },
					{
						name: "X-Required",
						in: "header",
						required: true,
						schema: { type: "string" },
					},
				],
				cookieParameters: [
					{ name: "optional", in: "cookie", schema: { type: "string" } },
					{
						name: "required",
						in: "cookie",
						required: true,
						schema: { type: "string" },
					},
				],
				operation: {
					method: "get",
					schema: { responses: {} },
					getResponseStatusCodes: () => [],
					getRequestBody: () => undefined,
				},
			},
		} as never);
		const generated = statements
			.map((statement) => JSON.stringify(statement))
			.join("\n");

		expect(generated).toContain("getUserHeaderParamsSchema");
		expect(generated).toContain("getUserCookieParamsSchema");
		expect(generated).toContain('\\"X-Optional\\": z.string().optional()');
		expect(generated).toContain('\\"X-Required\\": z.string()');
		expect(generated).toContain('\\"optional\\": z.string().optional()');
		expect(generated).toContain('\\"required\\": z.string()');
	});
});
