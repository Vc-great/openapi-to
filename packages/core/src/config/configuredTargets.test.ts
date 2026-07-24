import { describe, expect, it } from "vitest";

import type { OpenapiToConfigServer } from "../types";
import { selectConfiguredTargets } from "./configuredTargets.ts";

function server(
	name: string | undefined,
	path = "./openapi.yaml",
	dir = "generated",
): OpenapiToConfigServer {
	return {
		...(name === undefined ? {} : { name }),
		input: { path },
		output: { dir },
	};
}

describe("selectConfiguredTargets", () => {
	it("keeps legacy fallback names and returns requested targets in config order", () => {
		const servers = [
			server(undefined),
			server("order-service", "./order.yaml", "order"),
			server("payment-service", "./payment.yml", "payment"),
		];
		expect(
			selectConfiguredTargets({
				servers,
				requestedTargets: ["payment-service", "server1", "payment-service"],
			}).map(({ name }) => name),
		).toEqual(["server1", "payment-service"]);
	});

	it.each([
		[server(""), "CONFIG_TARGET_NAME_INVALID"],
		[server("   "), "CONFIG_TARGET_NAME_INVALID"],
		[server(" user-service"), "CONFIG_TARGET_NAME_INVALID"],
		[server("user\u0000service"), "CONFIG_TARGET_NAME_INVALID"],
	])("rejects unstable target names", (target, code) => {
		expect(() => selectConfiguredTargets({ servers: [target] })).toThrowError(
			expect.objectContaining({
				diagnostics: [expect.objectContaining({ code })],
			}),
		);
	});

	it("rejects fallback, case, and Unicode-normalized identity conflicts", () => {
		for (const servers of [
			[server(undefined), server("server1")],
			[server("User-Service"), server("user-service")],
			[server("é"), server("e\u0301")],
		]) {
			expect(() => selectConfiguredTargets({ servers })).toThrowError(
				expect.objectContaining({
					diagnostics: [
						expect.objectContaining({
							code: expect.stringMatching(
								/CONFIG_TARGET_(?:NAME_CONFLICT|NAME_INVALID)/,
							),
						}),
					],
				}),
			);
		}
	});

	it("fails the whole selection when any requested target is unknown", () => {
		expect(() =>
			selectConfiguredTargets({
				servers: [server("user-service"), server("order-service")],
				requestedTargets: ["user-service", "missing-service"],
			}),
		).toThrowError(
			expect.objectContaining({
				diagnostics: [
					expect.objectContaining({ code: "CONFIG_TARGET_UNKNOWN" }),
				],
			}),
		);
	});

	it.each([
		"file:///tmp/openapi.yaml",
		"ftp://example.com/openapi.yaml",
		"data:text/plain,x",
	])("rejects unsupported configured input protocol %s", (inputPath) => {
		expect(() =>
			selectConfiguredTargets({
				servers: [server("target", inputPath)],
			}),
		).toThrowError(
			expect.objectContaining({
				diagnostics: [
					expect.objectContaining({
						code: "CONFIG_INPUT_PROTOCOL_UNSUPPORTED",
					}),
				],
			}),
		);
	});
});
