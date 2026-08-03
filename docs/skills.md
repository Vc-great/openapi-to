# Consumer Agent Skills

Agent Skills do not replace openapi-to MCP. The MCP Server supplies the
deterministic, schema-bounded discovery, generation preview, and controlled
Prepare/Apply capabilities. A Skill supplies the calling order, scope choices,
approval boundary, business-code integration steps, and failure handling used
by an AI Host.

## First-stage Skill

The first stage ships one consumer workflow:

- [`openapi-to-generate`](../.agents/skills/openapi-to-generate/SKILL.md) finds
  the API Operations needed by a business feature, reads bounded contracts,
  prefers operation-scoped generation, prepares an exact write plan, waits for
  approval of its current `planHash`, applies that plan, and integrates the
  generated code into the consuming project.

Use it for requests such as “add user deletion from the API documentation”,
“find the order export endpoint and generate its request code”, or “implement
this page's API call with openapi-to”. Do not use it for pure frontend work or
for changing this Monorepo's MCP, CLI, Core, plugins, or release process.

The repository keeps one authoritative Skill source under
`.agents/skills/openapi-to-generate/`. Point a compatible Agent Skills installer
at this repository and select `openapi-to-generate`; do not copy or maintain a
second source tree inside this repository. The Skill interface metadata lives
beside it in `agents/openai.yaml`.

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

Before following any workflow, the Skill inspects the MCP Tools actually
exposed to the Host. The expected capability matrix is three analysis Tools
without config, eight read-only Tools with config, and ten Tools with config
plus `--allow-write`, but the actual Tool list takes precedence over a package
version or documentation claim.

Use the [getting-started guide](./getting-started.md) for package and project
configuration, then configure the trusted local Server with the
[Codex MCP guide](./codex-mcp.md). The write-enabled Codex example keeps
`openapi_apply_generation` in prompt approval mode.

## Phase boundary

This first stage provides workflow guidance and static contracts only. The
Skill never automatically installs dependencies or modifies `package.json`,
`openapi.config.ts`, or `.codex/config.toml`. A future `openapi-to-setup` Skill
may address installation and Host configuration. This stage does not add MCP
Tools, transports, authentication, runtime behavior, or automatic Apply.
