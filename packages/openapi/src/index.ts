export { defineConfig } from "@openapi-to/core";
export { definePlugin as createTSRequest } from "@openapi-to/openapi-ts-request";
export { definePlugin as createTSType } from "@openapi-to/openapi-ts-type";
export { definePlugin as createZod } from "@openapi-to/openapi-zod";
import updateNotifier from "update-notifier";

import packageJson from "../package.json" assert { type: "json" };

export function updateVersionNotifier() {
  updateNotifier({ pkg: packageJson }).notify();
}
export function createJSRequest() {}

export function createTanstackQuery() {}

export function createFaker() {}

export function createMSW() {}
