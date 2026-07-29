import { describe, expect, it } from "vitest";
import {
	getComponentExportName,
	getComponentFilePath,
	getComponentRefExportName,
} from "./componentNaming.ts";

describe("Zod component naming", () => {
	it.each([
		["schemas", "UserInput", "userInputSchema"],
		["parameters", "TraceId", "ParameterTraceIdModel"],
		["requestBodies", "CreateUser", "createUserSchema"],
		["responses", "NotFound", "ResponseNotFound"],
	] as const)(
		"names %s declarations and references identically",
		(category, name, expected) => {
			expect(getComponentExportName(category, name)).toBe(expected);
			expect(
				getComponentRefExportName(`#/components/${category}/${name}`),
			).toBe(expected);
		},
	);

	it("models file paths separately from export names", () => {
		expect(
			getComponentFilePath(
				"#/components/responses/NotFound",
				"/tmp/generated/zod",
			),
		).toBe("/tmp/generated/zod/responses/not-found.schema.ts");
	});
});
