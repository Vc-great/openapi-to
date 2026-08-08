import type { Operation } from "oas/operation";
import { describe, expect, it } from "vitest";
import { OperationAccessor } from "./OperationAccessor.ts";
import {
	isParameterRequired,
	resolveParameterSchema,
} from "./parameterSchema.ts";

function accessorFor(parameters: unknown[]): OperationAccessor {
	return new OperationAccessor({
		getParameters: () => parameters,
	} as unknown as Operation);
}

function accessorForDocument(
	parameters: unknown[],
	api: Record<string, unknown>,
): OperationAccessor {
	return new OperationAccessor({
		api,
		getParameters: () => parameters,
	} as unknown as Operation);
}

describe("OperationAccessor parameter classification", () => {
	it("classifies all four request parameter locations from parameter.in", () => {
		const accessor = accessorFor([
			{ name: "id", in: "path", required: false, schema: { type: "string" } },
			{ name: "q", in: "query", schema: { type: "string" } },
			{ name: "X-Request-Id", in: "header", schema: { type: "string" } },
			{ name: "session", in: "cookie", schema: { type: "string" } },
		]) as OperationAccessor & {
			headerParameters: unknown[];
			cookieParameters: unknown[];
		};

		expect(accessor.pathParameters).toHaveLength(1);
		expect(accessor.queryParameters).toHaveLength(1);
		expect(accessor.headerParameters).toHaveLength(1);
		expect(accessor.cookieParameters).toHaveLength(1);
		expect(accessor.pathParameters[0]?.required).toBe(true);
	});

	it("resolves referenced parameters with Core JSON Pointer semantics", () => {
		const accessor = accessorForDocument(
			[{ $ref: "#/components/parameters/Limit" }],
			{
				components: {
					parameters: {
						Limit: {
							name: "limit",
							in: "query",
							required: false,
							style: "form",
							explode: false,
							schema: { type: "integer" },
						},
					},
				},
			},
		);

		expect(accessor.queryParameters).toEqual([
			{
				$ref: "#/components/parameters/Limit",
				name: "limit",
				in: "query",
				required: false,
				style: "form",
				explode: false,
				schema: { type: "integer" },
			},
		]);
	});
});

describe("Parameter Object schema semantics", () => {
	it("uses schema first, otherwise the first declared media type", () => {
		expect(
			resolveParameterSchema({
				schema: { type: "boolean" },
				content: {
					"application/json": { schema: { type: "number" } },
				},
			}),
		).toEqual({ type: "boolean" });
		expect(
			resolveParameterSchema({
				content: {
					"application/json": { schema: { type: "number" } },
					"text/plain": { schema: { type: "string" } },
				},
			}),
		).toEqual({ type: "number" });
		expect(
			resolveParameterSchema({
				content: { "application/json": {} },
			}),
		).toBe(true);
	});

	it("always treats path parameters as required", () => {
		expect(isParameterRequired({ in: "path", required: false })).toBe(true);
		expect(isParameterRequired({ in: "header", required: false })).toBe(false);
	});
});
