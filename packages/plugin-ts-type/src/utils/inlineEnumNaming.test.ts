import { describe, expect, it } from "vitest";
import {
	getInlineEnumTypeName,
	getInlineSchemaContextName,
} from "./inlineEnumNaming.ts";

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
});
