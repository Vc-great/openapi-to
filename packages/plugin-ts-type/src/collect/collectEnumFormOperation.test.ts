import type { OperationWrapper } from "@openapi-to/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectEnumFormOperation } from "./collectEnumFormOperation";
import * as collectEnumsModule from "./collectEnumsFromDocument";

vi.mock("./collectEnumsFromDocument.ts", () => ({
	collectEnumsFromPathParameters: vi
		.fn()
		.mockReturnValue(["paramEnum1", "paramEnum2"]),
	collectEnumsFromPathRequestBodies: vi.fn().mockReturnValue(["requestEnum"]),
	collectEnumsFromPathResponses: vi.fn().mockImplementation((responses) => {
		if (responses && responses.length > 0) {
			return ["responseEnum"];
		}
		return [];
	}),
}));

describe("collectEnumFormOperation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("应该收集操作中的所有枚举", () => {
		// 创建模拟的 OperationWrapper
		const mockOperation = {
			path: "/test",
			method: "get",
			accessor: {
				operationName: "testOperation",
				parameters: [{ name: "param1", in: "query" }],
				operation: {
					schema: {
						requestBody: {
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: { type: { enum: ["A", "B"] } },
									},
								},
							},
						},
					},
					getResponseStatusCodes: vi.fn().mockReturnValue(["200", "404"]),
					getResponseAsJSONSchema: vi
						.fn()
						.mockImplementation((statusCode: string) => {
							if (statusCode === "200") {
								return [
									{ schema: { type: "string", enum: ["OK", "PARTIAL"] } },
								];
							}
							return [{ schema: { type: "string", enum: ["NOT_FOUND"] } }];
						}),
				},
			},
		};

		const result = collectEnumFormOperation(
			mockOperation as unknown as OperationWrapper,
		);

		// 验证函数调用与结果
		expect(
			collectEnumsModule.collectEnumsFromPathParameters,
		).toHaveBeenCalledWith(
			mockOperation.accessor.parameters,
			mockOperation.accessor.operationName,
			["paths", "/test", "get"],
		);

		expect(
			collectEnumsModule.collectEnumsFromPathRequestBodies,
		).toHaveBeenCalledWith(
			[
				"application/json",
				mockOperation.accessor.operation.schema.requestBody.content[
					"application/json"
				],
			],
			"TestOperationMutationRequest",
			["paths", "/test", "get"],
		);

		// 验证 getResponseAsJSONSchema 被调用了两次，对应两个状态码
		expect(
			mockOperation.accessor.operation.getResponseAsJSONSchema,
		).toHaveBeenCalledTimes(2);

		// 验证最终结果
		expect(result).toEqual([
			"paramEnum1",
			"paramEnum2", // 参数枚举
			"requestEnum", // 请求体枚举
			"responseEnum",
			"responseEnum", // 响应枚举，每个状态码一个
		]);
	});

	it("应该处理没有响应的情况", () => {
		const mockOperation = {
			path: "/empty",
			method: "get",
			accessor: {
				operationName: "emptyOperation",
				parameters: [],
				operation: {
					getResponseStatusCodes: vi.fn().mockReturnValue([]),
					getResponseAsJSONSchema: vi.fn(),
					getRequestBody: vi.fn().mockReturnValue(false),
				},
			},
		};

		const result = collectEnumFormOperation(
			mockOperation as unknown as OperationWrapper,
		);

		expect(
			mockOperation.accessor.operation.getResponseStatusCodes,
		).toHaveBeenCalled();
		expect(
			mockOperation.accessor.operation.getResponseAsJSONSchema,
		).not.toHaveBeenCalled();

		expect(result).toEqual(["paramEnum1", "paramEnum2", "requestEnum"]);
	});

	it("does not collect operation enums through a referenced request body", () => {
		const mockOperation = {
			path: "/test",
			method: "post",
			accessor: {
				operationName: "postTest",
				parameters: [],
				operation: {
					schema: {
						requestBody: { $ref: "#/components/requestBodies/Input" },
					},
					getResponseStatusCodes: vi.fn().mockReturnValue([]),
					getResponseAsJSONSchema: vi.fn(),
				},
			},
		};

		const result = collectEnumFormOperation(
			mockOperation as unknown as OperationWrapper,
		);

		expect(
			collectEnumsModule.collectEnumsFromPathRequestBodies,
		).not.toHaveBeenCalled();
		expect(result).toEqual(["paramEnum1", "paramEnum2"]);
	});
});
