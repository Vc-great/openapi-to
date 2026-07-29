//@ts-nocheck
import { describe, expect, it } from "vitest";
import { RequestClientEnum } from "../types";
import { buildMethodParameters } from "./buildMethodParameters";

type MethodParametersOperation = Parameters<typeof buildMethodParameters>[0];
type MethodParametersConfig = Parameters<typeof buildMethodParameters>[1];

describe("buildMethodParameters 函数测试", () => {
	it("应该生成请求体和查询参数", () => {
		const operation = {
			accessor: {
				hasPathParameters: false,
				hasRequestBody: true,
				hasQueryParameters: true,
				isQueryParametersOptional: true,
				parameters: [],
				operationTSType: {
					body: "Pet",
					queryParams: "PetQuery",
				},
			},
		};

		const ctx = {} as MethodParametersConfig;

		const result = buildMethodParameters(
			operation as MethodParametersOperation,
			ctx,
		);

		expect(result).toHaveLength(3); // body参数、query参数、requestConfig参数

		const bodyParam = result.find((p) => p.name === "data");
		expect(bodyParam?.type).toBe("Pet");

		const queryParam = result.find((p) => p.name === "params");
		expect(queryParam?.type).toBe("PetQuery");
		expect(queryParam?.hasQuestionToken).toBe(true);
	});

	it("应该生成路径参数", () => {
		const operation = {
			accessor: {
				hasPathParameters: true,
				hasRequestBody: false,
				hasQueryParameters: false,
				parameters: [{ in: "path", name: "petId" }],
				operationTSType: {
					pathParams: "PetParams",
				},
			},
		};

		const ctx = {} as MethodParametersConfig;

		const result = buildMethodParameters(
			operation as MethodParametersOperation,
			ctx,
		);

		const pathParam = result.find((p) => p.name === "petId");
		expect(pathParam).toBeDefined();
		expect(pathParam?.type).toContain("PetParams['petId']");
	});

	it("应该生成带有自定义请求配置类型的参数", () => {
		const operation = {
			accessor: {
				hasPathParameters: false,
				hasRequestBody: false,
				hasQueryParameters: false,
				parameters: [],
				operationTSType: () => ({}),
			},
		};

		const pluginConfig = {
			requestClient: RequestClientEnum.COMMON,
			requestConfigTypeImportDeclaration: {
				namedImports: ["CustomConfig"],
			},
		};

		const result = buildMethodParameters(operation, pluginConfig);

		const configParam = result.find((p) => p.name === "requestConfig");
		expect(configParam?.type).toBe("Partial<CustomConfig>");
	});

	it("keeps service parameters valid when an operation also has header and cookie parameters", () => {
		const result = buildMethodParameters(
			{
				accessor: {
					hasPathParameters: false,
					hasRequestBody: false,
					hasQueryParameters: false,
					hasHeaderParameters: true,
					hasCookieParameters: true,
					parameters: [
						{ in: "header", name: "X-Request-Id", required: true },
						{ in: "cookie", name: "session", required: true },
					],
					operationTSType: {
						headerParams: "HeaderParams",
						cookieParams: "CookieParams",
					},
				},
			} as MethodParametersOperation,
			{
				requestClient: RequestClientEnum.COMMON,
			} as MethodParametersConfig,
		);

		expect(result).toEqual([
			expect.objectContaining({
				name: "requestConfig",
				hasQuestionToken: true,
			}),
		]);
		expect(JSON.stringify(result)).not.toContain('"type":"undefined"');
	});
});
