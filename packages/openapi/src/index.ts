export { defineConfig } from "@openapi-to/core";
export { definePlugin as createFaker } from "@openapi-to/openapi-faker";
export { definePlugin as createMSW } from "@openapi-to/openapi-msw";
export { definePlugin as createTSRequest } from "@openapi-to/openapi-ts-request";
export { definePlugin as createTSType } from "@openapi-to/openapi-ts-type";
export { definePlugin as createZod } from "@openapi-to/openapi-zod";

export function createJSRequest() {}

export function createTanstackQuery() {}
