# openapi-to setup Skill

`openapi-to-setup` is the second consumer Agent Skills phase. It diagnoses and
configures openapi-to in a consuming project; it does not replace the local MCP
Server. The first-phase `openapi-to-generate` Skill starts only after setup and
handles API Operation discovery, selective generation, and business-code
integration.

These phase labels record delivery history. Phase 2.1 hardened Setup Plan
state hashing, and Phase 2.2 added Windows portable verified reads; both are
Setup hardening, not additional consumer Skills. The user journey still begins
with Setup and proceeds to Generate only after restart and capability
verification.

Use setup for package installation, the existing `openapi init` flow,
`/.openapi-to/` ignore repair, Codex project MCP configuration, startup
diagnosis, and 3/8/10 Tool-mode validation. A vague setup request defaults to
`read-only`. `write-enabled` is explicit and retains prompt approval for
`openapi_apply_generation`.

## Diagnose before changing anything

The Skill's standard-library inspector reads bounded project metadata without
executing `openapi.config.*`, walking generated/state directories, inspecting
global packages, accessing the network, or returning configuration bodies and
credentials. Its state hash binds raw-byte SHA-256 values for `package.json`,
every detected lockfile, generation config, `.gitignore`, and Codex config,
along with relevant existence states and diagnostics; it does not bind the
whole worktree. Lockfiles are streamed and limited to 32 MiB. The workflow
keeps local package declaration, one supported config, local command
resolution, Host configuration, Host restart, Server connection, and verified
Tool capability as distinct evidence.

Supported root configs are `openapi.config.ts`, `.js`, `.cjs`, and `.mjs`.
Multiple candidates block setup. `.openapi-to/` is runtime state; the retired
`.OpenAPI` config location is not used.

A missing manifest produces `PACKAGE_JSON_MISSING` and `BLOCKED`; setup never
creates a Node project or plans an install in an unconfirmed directory.
`PACKAGE_MISSING` means a valid `package.json` in a trusted project lacks only
the aggregate package. Multiple actual lockfiles—including two filenames for
the same manager—are a package-manager conflict. Oversized, unreadable,
symlinked, replaced, or out-of-root lockfiles fail closed without returning
their contents.

On platforms that expose `O_NOFOLLOW`, verified reads use
`O_RDONLY | O_NOFOLLOW`. Windows and other platforms without that constant use
a verified `O_RDONLY` fallback; they do not drop the initial `lstat`, symlink,
regular-file, real-root, or opened-file identity checks. All bytes are read
through the same `FileHandle`, followed by another identity and metadata check.
Any uncertainty remains `BLOCKED`. This is not an operating-system-level atomic
snapshot, so Git status and `observedStateHash` are checked again before a Setup
Plan executes. The focused Inspector suite runs in the repository's real
Ubuntu, macOS, and Windows A1 CI matrix.

## Approval-bound writes

Every package install, initializer run, ignore change, and Codex config change
requires a complete JSON Setup Plan bound to the current inspector state hash.
The plan shows exact argv, network use, expected writes, direct file diffs,
verification, and restart impact. Its canonical SHA-256 `setupPlanId` must be
named in explicit user approval. If the manifest, any lockfile, config, ignore
file, or Codex file changes, the Skill discards the approval, creates a new
Setup Plan and `setupPlanId`, and requires new exact approval. Git worktree
status is re-read separately immediately before execution.

The Skill never uses a global install and does not upgrade an existing
openapi-to version. Installation requires an exact version: explicit user
choice first, then a consistent exact local `@openapi-to/*` version, otherwise a
new version decision. It uses the aggregate package, not `@openapi-to/mcp` as a
business-environment substitute.

Automatic package writes are currently pnpm-only:

```sh
pnpm add -D --save-exact openapi-to@<exact-version>
```

npm, Yarn, and Bun are diagnosed but their install/config mutation remains
manual in this phase. Host automation is Codex-first; Claude Code, Cursor, and
generic stdio Hosts continue to use their existing manual guides.

## Codex restart and verification

The Skill may create a missing trusted project `.codex/config.toml` or append
one absent `openapi_to` section after exact approval. It preserves existing
bytes and unknown sections. An existing `openapi_to` section, duplicate section,
absolute path, or unrecognized TOML shape requires manual review; the Skill
does not implement a general TOML rewriter.

After a Codex config change, setup returns `RESTART_REQUIRED`. Only after the
user restarts Codex does the Skill inspect the actual Tool list, relevant Tool
inputSchema, and returned capability fields. Counts of 3, 8, and 10 are useful
orientation for analysis-only, read-only, and controlled-write modes, but a
matching count alone is not capability evidence.

Once the requested state is verified, use `openapi-to-generate`: read-only setup
supports discovery and preview; write-enabled setup supports its separately
approved Prepare/Apply workflow. Setup never performs that business generation
workflow or bypasses Apply approval.
