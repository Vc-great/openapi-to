//@ts-nocheck

import { describe, expect, it, vi } from "vitest";
import { buildComponentsResponse } from "@/builds/components/buildComponentsResponse.ts";
import { componentResponseTemplate } from "@/templates/componentResponseTemplate.ts";
import { createTypeAlias } from "@/templates/operationResponseTemplate.ts";
import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";

// 模拟依赖
vi.mock("@/utils/getUpperFirstRefAlias", () => ({
	getUpperFirstRefAlias: vi
		.fn()
		.mockImplementation((ref) => `Mock${ref.split("/").pop()}Type`),
}));

vi.mock("@/templates/operationResponseTemplate", () => ({
	createTypeAlias: vi
		.fn()
		.mockImplementation((name, type, docs) => ({ name, type, docs })),
}));

vi.mock("@/templates/componentResponseTemplate", () => ({
	componentResponseTemplate: vi
		.fn()
		.mockImplementation((_responseObj, name) => ({
			name,
			responseType: "mocked",
		})),
}));

describe("buildComponentsResponse", () => {
	it("应该处理引用类型的响应", () => {
		const response = { $ref: "#/components/responses/testResponse" };
		const result = buildComponentsResponse(response, "TestResponse");

		expect(getUpperFirstRefAlias).toHaveBeenCalledWith(
			"#/components/responses/testResponse",
		);
		expect(createTypeAlias).toHaveBeenCalledWith(
			"TestResponse",
			"MocktestResponseType",
			[],
		);
		expect(result).toEqual({
			name: "TestResponse",
			type: "MocktestResponseType",
			docs: [],
		});
	});

	it("应该处理带content的响应", () => {
		const response = {
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {},
					},
				},
			},
		};
		const result = buildComponentsResponse(response, "TestResponse");

		expect(componentResponseTemplate).toHaveBeenCalledWith(
			{ schema: response.content["application/json"].schema },
			"TestResponse",
		);
		expect(result).toEqual({
			name: "TestResponse",
			responseType: "mocked",
		});
	});

	it("maps empty content to undefined", () => {
		const response = { content: {} };
		const result = buildComponentsResponse(response, "TestResponse");
		expect(result).toEqual({
			name: "TestResponse",
			type: "undefined",
			docs: [],
		});
	});
});
