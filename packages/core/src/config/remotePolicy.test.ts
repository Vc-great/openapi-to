import { describe, expect, it } from "vitest";

import { resolveRemoteSourcePolicy } from "./remotePolicy.ts";

describe("resolveRemoteSourcePolicy", () => {
	it("preserves the trusted Target policy when no operator layer exists", () => {
		expect(
			resolveRemoteSourcePolicy({
				targetRemote: {
					allowPrivateNetwork: true,
					allowedHosts: ["schemas.example.com", "api.example.com"],
					headers: { Authorization: "Bearer target-secret" },
					timeoutMs: 15_000,
					maxResponseBytes: 5_000_000,
					maxRedirects: 2,
				},
			}),
		).toEqual({
			allowPrivateNetwork: true,
			allowedHosts: ["api.example.com", "schemas.example.com"],
			headers: { Authorization: "Bearer target-secret" },
			timeoutMs: 15_000,
			maxResponseBytes: 5_000_000,
			maxRedirects: 2,
		});
	});

	it.each([
		[
			{ allowedHosts: ["api.example.com"] },
			{ allowedHosts: ["api.example.com"] },
			["api.example.com"],
		],
		[
			{ allowedHosts: ["api.example.com", "schemas.example.com"] },
			{ allowedHosts: ["api.example.com"] },
			["api.example.com"],
		],
		[
			{ allowedHosts: ["*.example.com"] },
			{ allowedHosts: ["api.example.com"] },
			["api.example.com"],
		],
		[
			{ allowedHosts: ["*.api.example.com"] },
			{ allowedHosts: ["*.example.com"] },
			["*.api.example.com"],
		],
		[{ allowedHosts: ["api.example.com"] }, {}, ["api.example.com"]],
		[{}, { allowedHosts: ["api.example.com"] }, ["api.example.com"]],
	])(
		"intersects Target %# with operator %#",
		(targetRemote, operatorPolicy, allowedHosts) => {
			expect(
				resolveRemoteSourcePolicy({ targetRemote, operatorPolicy })
					?.allowedHosts,
			).toEqual(allowedHosts);
		},
	);

	it("fails before a request when host policies have no intersection", () => {
		expect(() =>
			resolveRemoteSourcePolicy({
				targetName: "payment-service",
				targetRemote: {
					allowedHosts: ["api.example.com"],
					headers: { Authorization: "Bearer must-not-leak" },
				},
				operatorPolicy: { allowedHosts: ["schemas.example.com"] },
			}),
		).toThrowError(
			expect.objectContaining({
				diagnostics: [
					expect.objectContaining({
						code: "CONFIG_REMOTE_POLICY_CONFLICT",
						message: expect.not.stringContaining("must-not-leak"),
					}),
				],
			}),
		);
	});

	it.each([
		[true, false, false],
		[false, true, false],
		[true, true, true],
		[undefined, true, false],
	])(
		"requires both layers to allow private access: Target %s / operator %s",
		(target, operator, expected) => {
			expect(
				resolveRemoteSourcePolicy({
					targetRemote: { allowPrivateNetwork: target },
					operatorPolicy: { allowPrivateNetwork: operator },
				})?.allowPrivateNetwork,
			).toBe(expected);
		},
	);

	it("retains Target headers and chooses the smaller numeric limits", () => {
		expect(
			resolveRemoteSourcePolicy({
				targetRemote: {
					headers: { Authorization: "Bearer target-secret" },
					timeoutMs: 10_000,
					maxResponseBytes: 10_000_000,
					maxRedirects: 5,
				},
				operatorPolicy: {
					timeoutMs: 5_000,
					maxResponseBytes: 2_000_000,
					maxRedirects: 2,
				},
			}),
		).toMatchObject({
			headers: { Authorization: "Bearer target-secret" },
			timeoutMs: 5_000,
			maxResponseBytes: 2_000_000,
			maxRedirects: 2,
		});
	});
});
