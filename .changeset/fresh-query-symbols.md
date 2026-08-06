---
"@openapi-to/cli": patch
"@openapi-to/plugin-msw": patch
"@openapi-to/plugin-swr": patch
"@openapi-to/plugin-ts-type": patch
"openapi-to": patch
---

Make the default initialized configuration directly generatable by selecting
SWR as its single query plugin, and emit one structured JSON document for
`init --json`.

Keep inline enum declarations and references on one collision-safe symbol,
remove the unused implicit-any SWR fetcher parameter, and narrow schema-less
JSON response data only at MSW's `HttpResponse.json` boundary.

Disambiguate distinct inline-enum schema paths that normalize to the same
readable TypeScript identifier.
