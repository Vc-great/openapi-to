import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRefImports } from "./buildRefImports.ts";

describe("buildRefImports", () => {
	const componentRoot = path.resolve("/generated/types");

	it("filters self imports by resolved path and keeps external refs", () => {
		const filePath = path.join(componentRoot, "models/node.model.ts");
		const imports = buildRefImports(
			[
				"#/components/schemas/Node",
				"#/components/schemas/External",
				"#/components/schemas/Node",
			],
			filePath,
			componentRoot,
			false,
		);

		expect(imports).toHaveLength(1);
		expect(imports[0]).toMatchObject({
			moduleSpecifier: "./external.model",
			namedImports: ["ExternalModel"],
		});
	});

	it("deduplicates names and sorts imports deterministically", () => {
		const filePath = path.join(componentRoot, "models/current.model.ts");
		const imports = buildRefImports(
			[
				"#/components/schemas/Zed",
				"#/components/schemas/Alpha",
				"#/components/schemas/Zed",
			],
			filePath,
			componentRoot,
			true,
		);

		expect(imports).toEqual([
			expect.objectContaining({
				moduleSpecifier: "./alpha.model.ts",
				namedImports: ["AlphaModel"],
			}),
			expect.objectContaining({
				moduleSpecifier: "./zed.model.ts",
				namedImports: ["ZedModel"],
			}),
		]);
	});
});
