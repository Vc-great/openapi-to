---
"@openapi-to/core": minor
"@openapi-to/cli": minor
"@openapi-to/mcp": minor
"openapi-to": minor
---

Add shared microservice Target selection and generator-managed Workspace output
roots. The CLI now accepts repeatable `generate --target` options while Core,
CLI, MCP, and packed-package smoke workflows share deterministic Target naming,
output resolution, overlap protection, and write preflight.

Preserve and verify JSON, YAML, YML, and HTTP(S) OpenAPI inputs across
multi-target CLI and MCP workflows. Default output remains
`.openapi-to/<output.dir>`; opting into `output.base: "workspace"` keeps ownership
inside the selected project output root while Operation selection remains in
`.openapi-to/selections`.
