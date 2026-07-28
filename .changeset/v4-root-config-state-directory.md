---
"@openapi-to/core": major
"@openapi-to/mcp": major
"@openapi-to/cli": major
"@openapi-to/plugin-msw": major
"@openapi-to/plugin-swr": major
"@openapi-to/plugin-ts-request": major
"@openapi-to/plugin-ts-type": major
"@openapi-to/plugin-vue-query": major
"@openapi-to/plugin-zod": major
"openapi-to": major
---

Move automatic configuration discovery to root `openapi.config.ts`, `.js`,
`.cjs`, or `.mjs` files and move tool-managed state and managed output to
`.openapi-to`.

The former `.OpenAPI` configuration location is no longer discovered, and Core
replaces the removed `folderName` export with `stateDirectoryName`. No
compatibility fallback or automatic migration is provided; move the
configuration and any state that must be retained manually.
