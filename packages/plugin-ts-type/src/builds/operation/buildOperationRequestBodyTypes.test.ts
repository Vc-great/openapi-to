import { describe, expect, it } from "vitest";
import { buildOperationRequestBodyTypes } from "@/builds/operation/buildOperationRequestBodyTypes";

describe("buildOperationRequestBodyTypes", () => {
	it("should return null when no request body is present", () => {
		const mockOperation = {
			path: "/users/{id}",
			method: "get",
			tagName: "users",
			accessor: {
				operationId: "getUser",
				operationName: "getUser",
				operation: {
					schema: {
						requestBody: undefined,
					},
					getRequestBody: () => undefined,
				},
			},
		};

		const result = buildOperationRequestBodyTypes(mockOperation as never);
		expect(result).toBeUndefined();
	});

	it("should build request body types from direct schema", () => {
		const mockOperation = {
			path: "/users",
			method: "post",
			tagName: "users",
			accessor: {
				operationId: "createUser",
				operationName: "createUser",
				operation: {
					schema: {
						requestBody: {},
					},
					getRequestBody: () => ({
						schema: {
							type: "object",
							properties: {
								name: { type: "string" },
								email: { type: "string" },
							},
							required: ["name", "email"],
						},
					}),
				},
			},
		};

		const result = buildOperationRequestBodyTypes(mockOperation as never);

		expect(result).not.toBeNull();
		expect(result?.name).toBe("CreateUserMutationRequest");
		if (!result) throw new Error("Expected a generated request body type");

		// TypeAliasDeclaration 或 InterfaceDeclaration 确保有正确的结构
		if ("properties" in result) {
			// InterfaceDeclaration
			expect(result.properties?.length).toBeGreaterThan(0);
		} else if ("type" in result) {
			// TypeAliasDeclaration
			expect(result.type).toBeDefined();
		}
	});

	it("should handle $ref in request body", () => {
		const mockOperation = {
			path: "/users/{id}",
			method: "put",
			tagName: "users",
			accessor: {
				operationId: "updateUser",
				operationName: "updateUser",
				operation: {
					schema: {
						requestBody: {
							$ref: "#/components/schemas/User",
						},
					},
					getRequestBody: () => undefined,
				},
			},
		};

		const result = buildOperationRequestBodyTypes(mockOperation as never);
		expect(result).not.toBeNull();
		expect(result?.name).toBe("UpdateUserMutationRequest");
	});

	it("should handle array response from getRequestBody", () => {
		const mockOperation = {
			path: "/users/bulk",
			method: "post",
			tagName: "users",
			accessor: {
				operationId: "createBulkUsers",
				operationName: "createBulkUsers",
				operation: {
					schema: {
						requestBody: {},
					},
					getRequestBody: () => [
						{ contentType: "application/json" },
						{
							schema: {
								type: "array",
								items: {
									type: "object",
									properties: {
										name: { type: "string" },
									},
								},
							},
						},
					],
				},
			},
		};

		const result = buildOperationRequestBodyTypes(mockOperation as never);
		expect(result).not.toBeNull();
		expect(result?.name).toBe("CreateBulkUsersMutationRequest");
	});

	it("preserves nullable beside a request-body schema $ref", () => {
		const result = buildOperationRequestBodyTypes({
			accessor: {
				operationName: "updateUser",
				operation: {
					schema: { requestBody: { content: { "application/json": {} } } },
					getRequestBody: () => ({
						schema: {
							$ref: "#/components/schemas/User",
							nullable: true,
						},
					}),
				},
			},
		} as never);

		expect(result).toMatchObject({
			name: "UpdateUserMutationRequest",
			type: "UserModel | null",
		});
	});
});
