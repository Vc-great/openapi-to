# Consumer Agent Skills

Agent Skills do not replace openapi-to MCP. The MCP Server supplies the
deterministic, schema-bounded discovery, generation preview, and controlled
Prepare/Apply capabilities. A Skill supplies the calling order, scope choices,
approval boundary, business-code integration steps, and failure handling used
by an AI Host.

## Two consumer phases

The repository ships two specialized consuming-project workflows:

- [`openapi-to-setup`](../.agents/skills/openapi-to-setup/SKILL.md) diagnoses
  package, config, ignore, local command, Codex project configuration, restart,
  and actual Tool capability. It defaults ambiguous setup requests to
  read-only and requires exact Setup Plan approval for every write.

- [`openapi-to-generate`](../.agents/skills/openapi-to-generate/SKILL.md) finds
  the API Operations needed by a business feature, reads bounded contracts,
  prefers operation-scoped generation, prepares an exact write plan, waits for
  approval of its current `planHash`, applies that plan, and integrates the
  generated code into the consuming project.

Use setup for “configure openapi-to in this project”, “why are only three Tools
visible?”, or “enable controlled writes”. Use generate for requests such as
“add user deletion from the API documentation”,
“find the order export endpoint and generate its request code”, or “implement
this page's API call with openapi-to”. Do not use it for pure frontend work or
for changing this Monorepo's MCP, CLI, Core, plugins, or release process.

The repository keeps one authoritative source per Skill under `.agents/skills/`.
Point a compatible Agent Skills installer at this repository and select
`openapi-to-setup` or `openapi-to-generate`; do not copy or maintain a second
source tree inside this repository. Interface metadata lives beside each Skill
in `agents/openai.yaml`. The canonical GitHub directories are:

```text
https://github.com/Vc-great/openapi-to/tree/main/.agents/skills/openapi-to-generate
https://github.com/Vc-great/openapi-to/tree/main/.agents/skills/openapi-to-setup
```

Installer commands and discovery behavior vary by Agent Host. Use a compatible
Host's supported Skill installation flow; do not assume every Host accepts the
same command.

## Consumer prerequisites

Install the aggregate package in the consuming Workspace:

```sh
pnpm add -D openapi-to
```

The Skill must use the consuming project's local version. It must not silently
fall back to a global installation, and ordinary users do not need a separate
`@openapi-to/mcp` installation. Launch the local stdio Server through:

```sh
pnpm exec openapi-to-mcp
```

Keep the generation config in the Workspace root as `openapi.config.ts`. Keep
that location distinct from `.openapi-to/`, which is openapi-to's runtime state
directory.

`@openapi-to/mcp` remains an advanced MCP-only package boundary. The consumer
Skill MVP targets business projects with the aggregate `openapi-to` package and
must not assume that an MCP-only installation is a complete code-generation
environment. Broader MCP-only consumer support requires separate design.

Before following any workflow, the Skill inspects the MCP Tools actually
exposed to the Host and each relevant current Tool inputSchema. The expected
capability matrix is three analysis Tools without config, eight read-only Tools
with config, and ten Tools with config plus `--allow-write`, but counts are only
orientation. The actual Tool list, Tool inputSchema, and capability fields
returned by current calls take precedence over the consuming project's local
package version, which takes precedence over current or historical
documentation. A matching Tool name does not prove that its newer inputSchema
capabilities exist.

Operation-scoped Dry Run is available only when the current Schema supports
`targets`, `scope.type = operations`, and `scope.operationKeys`. It must use
exactly one grounded Target; in a multi-Target project, list Targets first and
never guess or rely on an omitted Target's default behavior:

```json
{
  "targets": ["<exact-target>"],
  "scope": {
    "type": "operations",
    "operationKeys": ["<exact-operation-key>"]
  }
}
```

If selective Dry Run is unsupported, the Skill stays read-only instead of
falling back to full-target generation. Selection `add` requires explicit
Schema support for `selection` and operation keys; `replace` additionally
requires explicit current inputSchema support for `selection.type = replace`.
When a Host cannot expose inputSchema, the Skill reports that limitation and
fails closed for version-sensitive capabilities rather than sending parameters
from the latest documentation to an older local Tool.

Use the [getting-started guide](./getting-started.md) for package and project
configuration, then configure the trusted local Server with the
[Codex MCP guide](./codex-mcp.md). The write-enabled Codex example keeps
`openapi_apply_generation` in prompt approval mode.

## Phase boundary

The setup Skill is phase two. It runs read-only diagnosis first, uses the
existing `openapi init`, does not upgrade an existing version, and supports
automatic package mutation only for pnpm. Every installation or configuration
change requires the exact current Setup Plan ID. Codex project configuration
is Codex-first; npm, Yarn, and Bun plus Claude Code, Cursor, and generic Host
writes remain diagnostic/manual boundaries. Host changes return
`RESTART_REQUIRED`, and the actual Tool list plus current Tool inputSchema are
verified only after restart. See [the setup guide](./setup-skill.md).

The generate Skill remains phase one and never installs dependencies or
modifies `package.json`, `openapi.config.ts`, or `.codex/config.toml`. Setup does
not add MCP Tools or replace MCP, and it hands daily API discovery, selective
generation, and integration to generate after the requested mode is verified.
