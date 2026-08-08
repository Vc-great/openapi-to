import { describe, expect, it } from "vitest";
import { EnumRegistry } from "./EnumRegistry.ts";

describe("EnumRegistry inline enum symbol defense", () => {
	it("fails closed when two schema paths claim one final symbol", () => {
		const registry = new EnumRegistry();
		registry.add(
			"CollisionModelSimilarName",
			["lower"],
			undefined,
			["components", "schemas", "CollisionModel", "properties", "similarName"],
		);

		expect(() =>
			registry.add(
				"CollisionModelSimilarName",
				["upper"],
				undefined,
				["components", "schemas", "CollisionModel", "properties", "SimilarName"],
			),
		).toThrowError(
			/CollisionModelSimilarNameEnumValue.*#\/components\/schemas\/CollisionModel\/properties\/similarName.*#\/components\/schemas\/CollisionModel\/properties\/SimilarName/,
		);
	});

	it("does not fall back to a different path with the same enum values", () => {
		const registry = new EnumRegistry();
		registry.add("FirstPath", ["shared"]);

		expect(() =>
			registry.getEnumValueName(["shared"], "SecondPath"),
		).toThrowError("Enum symbol not found: SecondPathEnumValue");
	});
});
