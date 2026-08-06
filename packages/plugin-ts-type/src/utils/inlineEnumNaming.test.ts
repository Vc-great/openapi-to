import { describe, expect, it } from "vitest";
import {
	formatSourcePath,
	getInlineEnumTypeName,
	getInlineSchemaContextName,
	InlineEnumSymbolAllocator,
} from "./inlineEnumNaming.ts";

function allocatePropertySymbols(propertyNames: readonly string[]) {
	const sources = propertyNames.map((propertyName) => ({
		name: getInlineSchemaContextName("CollisionModel", propertyName),
		propertyName,
		sourcePath: [
			"components",
			"schemas",
			"CollisionModel",
			"properties",
			propertyName,
		],
	}));
	const allocator = new InlineEnumSymbolAllocator(sources);
	return new Map(
		sources.map((source) => [
			source.propertyName,
			allocator.getTypeName(
				source.sourcePath,
				getInlineEnumTypeName("CollisionModel", source.propertyName),
			),
		]),
	);
}

describe("REG-INLINE-ENUM-SYMBOL-CASING", () => {
	it("uses one casing-preserving symbol source for nested enum declarations and references", () => {
		expect(getInlineSchemaContextName("User", "optionalInline")).toBe(
			"UserOptionalInline",
		);
		expect(
			getInlineEnumTypeName(
				getInlineSchemaContextName("User", "optionalInline"),
				"mode",
			),
		).toBe("UserOptionalInlineModeEnumValue");
		expect(getInlineEnumTypeName("User", "HTTPMode")).toBe(
			"UserHTTPModeEnumValue",
		);
	});

	it("keeps distinct raw property names collision-free and valid", () => {
		const names = [
			getInlineEnumTypeName("User", "similarName"),
			getInlineEnumTypeName("User", "similar-name"),
			getInlineEnumTypeName("User", "similar_name"),
			getInlineEnumTypeName("User", "similar_u2d_Name"),
		];
		expect(new Set(names).size).toBe(names.length);
		expect(names).toEqual([
			"UserSimilarNameEnumValue",
			"UserSimilar_u2d_NameEnumValue",
			"UserSimilar_nameEnumValue",
			"UserSimilar_u5f_u2d_NameEnumValue",
		]);
		expect(names.every((name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name))).toBe(
			true,
		);
	});

	it("does not collapse casing-distinct property paths", () => {
		const properties = [
			"similarName",
			"SimilarName",
			"similar-name",
			"similar-Name",
		];
		const generatedNames = [...allocatePropertySymbols(properties).values()];

		expect(new Set(generatedNames).size).toBe(generatedNames.length);
	});

	it("does not collapse casing-distinct recursive parent paths", () => {
		const sources = ["foo-bar", "foo-Bar"].map((propertyName) => ({
			name: getInlineSchemaContextName(
				getInlineSchemaContextName("CollisionModel", propertyName),
				"mode",
			),
			sourcePath: [
				"components",
				"schemas",
				"CollisionModel",
				"properties",
				propertyName,
				"properties",
				"mode",
			],
		}));
		const allocator = new InlineEnumSymbolAllocator(sources);
		const generatedNames = sources.map((source) =>
			allocator.getTypeName(source.sourcePath, `${source.name}EnumValue`),
		);

		expect(new Set(generatedNames).size).toBe(generatedNames.length);
	});

	it("allocates valid, stable symbols for adversarial property names", () => {
		const properties = [
			"similarName",
			"SimilarName",
			"similar-name",
			"similar-Name",
			"similar_name",
			"similar_Name",
			"similar_u2d_Name",
			"similar_u2d_name",
			"HTTPMode",
			"httpMode",
			"1mode",
			"$mode",
			"模式",
		];
		const forward = allocatePropertySymbols(properties);
		const repeated = allocatePropertySymbols(properties);
		const reversed = allocatePropertySymbols([...properties].reverse());

		expect(new Set(forward.values()).size).toBe(properties.length);
		expect(
			[...forward.values()].every((name) =>
				/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name),
			),
		).toBe(true);
		expect([...repeated]).toEqual([...forward]);
		expect(
			[...reversed].sort(([left], [right]) =>
				String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
			),
		).toEqual(
			[...forward].sort(([left], [right]) =>
				String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
			),
		);
		expect(forward.get("similar_name")).toBe(
			"CollisionModelSimilar_nameEnumValue",
		);
		expect(forward.get("similar_u2d_Name")).toBe(
			"CollisionModelSimilar_u5f_u2d_NameEnumValue",
		);
		expect(forward.get("1mode")).toBe("CollisionModel1modeEnumValue");
		expect(forward.get("$mode")).toBe("CollisionModel$modeEnumValue");
		expect(forward.get("模式")).toBe(
			"CollisionModel_u6a21__u5f0f_EnumValue",
		);
		expect(
			[...forward]
				.filter(([, symbol]) => /__[0-9a-f]{12}EnumValue$/.test(symbol))
				.map(([name]) => name),
		).toEqual([
			"similarName",
			"SimilarName",
			"similar-name",
			"similar-Name",
		]);
	});

	it("disambiguates one candidate across collection domains", () => {
		const sources = [
			{
				name: "RequestBodiesFooModel",
				sourcePath: [
					"components",
					"schemas",
					"RequestBodiesFoo",
					"properties",
					"model",
				],
			},
			{
				name: "RequestBodiesFooModel",
				sourcePath: [
					"components",
					"requestBodies",
					"foo",
					"content",
					"application/json",
					"schema",
				],
			},
		];
		const allocator = new InlineEnumSymbolAllocator(sources);
		const symbols = sources.map((source) =>
			allocator.getTypeName(source.sourcePath, `${source.name}EnumValue`),
		);

		expect(new Set(symbols).size).toBe(2);
		expect(symbols.every((symbol) => /__[0-9a-f]{12}EnumValue$/.test(symbol))).toBe(
			true,
		);
	});

	it("fails closed when a disambiguated symbol collides with another legacy candidate", () => {
		expect(
			() =>
				new InlineEnumSymbolAllocator([
					{ name: "Foo", sourcePath: ["a"] },
					{ name: "Foo", sourcePath: ["b"] },
					{ name: "Foo__0eb5b8d6f81b", sourcePath: ["c"] },
				]),
		).toThrowError(/Foo__0eb5b8d6f81bEnumValue.*#\/a.*#\/c/);
	});

	it("keeps bounded long-path diagnostics distinguishable", () => {
		const prefix = "x".repeat(600);
		const first = formatSourcePath([prefix, "first"]);
		const second = formatSourcePath([prefix, "second"]);

		expect(first.length).toBeLessThanOrEqual(512);
		expect(second.length).toBeLessThanOrEqual(512);
		expect(first).not.toBe(second);
		expect(first).toMatch(/<sha256:[0-9a-f]{12}>$/);
	});
});
