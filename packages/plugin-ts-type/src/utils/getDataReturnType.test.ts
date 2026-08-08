import type { OperationWrapper } from "@openapi-to/core";
import { describe, expect, it, vi } from "vitest";
import { getDataReturnType } from "./getDataReturnType.ts";

describe("getDataReturnType", () => {
	it("inspects a referenced response without invoking oas conversion", () => {
		const getResponseAsJSONSchema = vi.fn(() => {
			throw new Error("referenced responses must not be converted by oas");
		});
		const operation = {
			accessor: {
				operation: {
					schema: {
						responses: {
							"200": { $ref: "#/components/responses/UserResponse" },
						},
					},
					api: {
						components: {
							responses: {
								UserResponse: {
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/User" },
										},
									},
								},
							},
							schemas: {
								User: {
									type: "object",
									properties: {
										id: { type: "string" },
										tags: { type: "array" },
									},
								},
							},
						},
					},
					getResponseAsJSONSchema,
				},
			},
		} as unknown as OperationWrapper;

		expect(getDataReturnType(operation)).toEqual(["id", "tags"]);
		expect(getResponseAsJSONSchema).not.toHaveBeenCalled();
	});

	it("collects top-level properties through bounded allOf and ref chains", () => {
		const operation = {
			accessor: {
				operation: {
					schema: {
						responses: {
							"200": { $ref: "#/components/responses/EnvelopeResponse" },
						},
					},
					api: {
						components: {
							responses: {
								EnvelopeResponse: {
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/Envelope" },
										},
									},
								},
							},
							schemas: {
								Envelope: {
									allOf: [
										{ $ref: "#/components/schemas/EnvelopeMetadata" },
										{
											type: "object",
											properties: { data: { type: "array" } },
										},
									],
								},
								EnvelopeMetadata: {
									type: "object",
									properties: { meta: { type: "object" } },
								},
							},
						},
					},
				},
			},
		} as unknown as OperationWrapper;

		expect(getDataReturnType(operation)).toEqual(["meta", "data"]);
	});
});
