import { access, link, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { ARTIFACT_MANIFEST_FILENAME, serializeOperationSelectionManifest } from '@openapi-to/core'
import { describe, expect, it } from 'vitest'

import { TrustedTargetCatalogRegistry } from '../catalog/trusted-target-registry.ts'
import { resolveMcpServerOptions } from '../options.ts'
import { applyGenerationTool } from '../tools/apply-generation.ts'
import { GenerationPlanStore } from './plan-store.ts'
import {
  assertGenerationPlanApplySupported,
  applyGenerationWritePlan,
  hashDeterministicGenerationPlan,
  prepareGenerationWritePlan,
  prepareSelectiveGenerationWritePlan,
  type InternalGenerationWritePlan,
} from './write-plan.ts'
import { prepareOperationSelection } from './selection-state.ts'
import { TrustedConfigProvider } from './trusted-config.ts'

async function fixture(options: { duplicate?: boolean; missingId?: boolean; secondTarget?: boolean; sharedOutput?: boolean } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-mcp-selection-'))
  await mkdir(path.join(root, '.OpenAPI'))
  const operationId = options.missingId ? '' : 'operationId: getUser'
  await writeFile(path.join(root, 'openapi.yaml'), `openapi: 3.1.0
info: { title: Selection, version: "1" }
paths:
  /users/{id}:
    get:
      ${operationId}
      responses: { "200": { description: ok, content: { application/json: { schema: { $ref: "#/components/schemas/User" } } } } }
  /users:
    post:
      operationId: ${options.duplicate ? 'getUser' : 'createUser'}
      responses: { "201": { description: created } }
  /health:
    get:
      operationId: health
      responses: { "204": { description: ok } }
components:
  schemas:
    User: { type: object, properties: { id: { type: string } } }
`)
  const servers = [
    `{ name: 'main', input: { path: './openapi.yaml' }, output: { dir: 'generated', clean: true } }`,
    ...(options.secondTarget ? [`{ name: 'second', input: { path: './openapi.yaml' }, output: { dir: '${options.sharedOutput ? 'generated' : 'generated-second'}', clean: true } }`] : []),
  ]
  await writeFile(path.join(root, '.OpenAPI/openapi.config.cjs'), `module.exports = {
  servers: [${servers.join(',')}],
  plugins: [{ name: 'selection-fixture', hooks: { operation(operation, ctx) {
    const id = operation.accessor.operationId;
    ctx.addArtifact({ kind: 'text', path: ctx.openapiToSingleConfig.output.dir + '/' + id + '.txt', content: id + '\\n' });
  } } }]
};
`)
  const resolved = resolveMcpServerOptions({ workspaceRoot: root, configPath: '.OpenAPI/openapi.config.cjs', allowWrite: true })
  const provider = new TrustedConfigProvider(resolved.workspaceRoot, '.OpenAPI/openapi.config.cjs')
  const registry = new TrustedTargetCatalogRegistry(provider, resolved)
  return { root: resolved.workspaceRoot, resolved, provider, registry }
}

function store() {
  return new GenerationPlanStore<InternalGenerationWritePlan>({
    ttlMs: 60_000,
    maxPlans: 20,
    maxPlanBytes: 4 * 1024 * 1024,
    maxTotalPlanBytes: 32 * 1024 * 1024,
  })
}

async function persistSelection(prepared: Awaited<ReturnType<typeof prepareOperationSelection>>) {
  await mkdir(path.dirname(prepared.selectionFile), { recursive: true })
  await writeFile(prepared.selectionFile, serializeOperationSelectionManifest(prepared.merge.manifest))
}

describe('trusted persistent operation selection state', () => {
  it('bootstraps an empty state and deterministically normalizes requested additions', async () => {
    const context = await fixture()
    const prepared = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser', 'createUser', 'getUser'] })
    expect(prepared.previousSelectionExists).toBe(false)
    expect(prepared.merge).toMatchObject({
      previousOperationKeys: [],
      requestedOperationKeys: ['createUser', 'getUser'],
      newlyAddedOperationKeys: ['createUser', 'getUser'],
      alreadySelectedOperationKeys: [],
      desiredOperationKeys: ['createUser', 'getUser'],
    })
    expect(prepared.selectionFileIdentity).toMatch(/^\.OpenAPI\/selections\/main-[a-f0-9]{16}\.json$/)
    expect(prepared.selectionOwner).not.toContain(context.root)
  })

  it('unions a persisted previous selection with additions and treats duplicates as a no-op', async () => {
    const context = await fixture()
    const first = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await persistSelection(first)
    const merged = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser', 'getUser'] })
    expect(merged.merge).toMatchObject({
      previousOperationKeys: ['getUser'],
      requestedOperationKeys: ['createUser', 'getUser'],
      newlyAddedOperationKeys: ['createUser'],
      alreadySelectedOperationKeys: ['getUser'],
      desiredOperationKeys: ['createUser', 'getUser'],
    })
  })

  it('fails closed when ownership exists without selection state', async () => {
    const context = await fixture()
    const output = path.join(context.root, '.OpenAPI/generated')
    await mkdir(output)
    await writeFile(path.join(output, ARTIFACT_MANIFEST_FILENAME), '{"version":2,"files":[]}\n')
    await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_BOOTSTRAP_REQUIRED' }] })
  })

  it('fails closed for unmanaged output and for selection without ownership beside non-empty output', async () => {
    const unmanaged = await fixture()
    await mkdir(path.join(unmanaged.root, '.OpenAPI/generated'))
    await writeFile(path.join(unmanaged.root, '.OpenAPI/generated/user.txt'), 'user\n')
    await expect(prepareOperationSelection(unmanaged.provider, unmanaged.resolved, unmanaged.registry, ['main'], { type: 'add', operationKeys: ['getUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_BOOTSTRAP_REQUIRED' }] })

    const inconsistent = await fixture()
    const initial = await prepareOperationSelection(inconsistent.provider, inconsistent.resolved, inconsistent.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await persistSelection(initial)
    await mkdir(path.join(inconsistent.root, '.OpenAPI/generated'))
    await writeFile(path.join(inconsistent.root, '.OpenAPI/generated/user.txt'), 'user\n')
    await expect(prepareOperationSelection(inconsistent.provider, inconsistent.resolved, inconsistent.registry, ['main'], { type: 'add', operationKeys: ['createUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_STATE_INCONSISTENT' }] })
  })

  it('rejects corrupted, unsupported, and mismatched manifests', async () => {
    for (const manifest of [
      '{',
      JSON.stringify({ version: 2, target: 'main', selectionOwner: 'x', operations: [] }),
      JSON.stringify({ version: 1, target: 'other', selectionOwner: 'x', operations: [] }),
    ]) {
      const context = await fixture()
      const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      await mkdir(path.dirname(initial.selectionFile), { recursive: true })
      await writeFile(initial.selectionFile, manifest)
      await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] })).rejects.toBeDefined()
    }
  })

  it('rejects a selection file larger than the bounded read limit', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await mkdir(path.dirname(initial.selectionFile), { recursive: true })
    await writeFile(initial.selectionFile, 'x'.repeat(1024 * 1024 + 1))
    await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_MANIFEST_TOO_LARGE' }] })
  })

  it.runIf(process.platform !== 'win32')('rejects symbolic-linked selection state even when the target remains in the Workspace', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await mkdir(path.dirname(initial.selectionFile), { recursive: true })
    await symlink(path.join(context.root, 'openapi.yaml'), initial.selectionFile)
    await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_STATE_INCONSISTENT' }] })
  })

  it.runIf(process.platform !== 'win32')('rejects hard-linked selection state', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await persistSelection(initial)
    await link(initial.selectionFile, path.join(path.dirname(initial.selectionFile), 'alias.json'))
    await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_STATE_INCONSISTENT' }] })
  })

  it('fails historical drift without automatically deleting or renaming operations', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await mkdir(path.dirname(initial.selectionFile), { recursive: true })
    await writeFile(initial.selectionFile, serializeOperationSelectionManifest({ ...initial.merge.manifest, operations: ['renamedOperation'] }))
    await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTION_OPERATION_NOT_FOUND' }] })
  })

  it('rejects empty mutations and operations with missing or duplicated operationId', async () => {
    const empty = await fixture()
    await expect(prepareOperationSelection(empty.provider, empty.resolved, empty.registry, ['main'], { type: 'add', operationKeys: [] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'EMPTY_SELECTION_MUTATION' }] })
    const missing = await fixture({ missingId: true })
    await expect(prepareOperationSelection(missing.provider, missing.resolved, missing.registry, ['main'], { type: 'add', operationKeys: ['GET /users/{id}'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTIVE_PREPARE_OPERATION_ID_REQUIRED' }] })
    const duplicate = await fixture({ duplicate: true })
    await expect(prepareOperationSelection(duplicate.provider, duplicate.resolved, duplicate.registry, ['main'], { type: 'add', operationKeys: ['GET /users/{id}'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTIVE_PREPARE_DUPLICATE_OPERATION_ID' }] })
  })

  it('requires one target and isolates owners for targets with identical operation keys', async () => {
    const context = await fixture({ secondTarget: true })
    await expect(prepareOperationSelection(context.provider, context.resolved, context.registry, ['main', 'second'], { type: 'add', operationKeys: ['getUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'SELECTIVE_PREPARE_SINGLE_TARGET_REQUIRED' }] })
    const [main, second] = await Promise.all([
      prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] }),
      prepareOperationSelection(context.provider, context.resolved, context.registry, ['second'], { type: 'add', operationKeys: ['getUser'] }),
    ])
    expect(main.selectionOwner).not.toBe(second.selectionOwner)
    expect(main.selectionFile).not.toBe(second.selectionFile)
    const shared = await fixture({ secondTarget: true, sharedOutput: true })
    await expect(prepareOperationSelection(shared.provider, shared.resolved, shared.registry, ['main'], { type: 'add', operationKeys: ['getUser'] }))
      .rejects.toMatchObject({ diagnostics: [{ code: 'CONFIG_OUTPUT_OVERLAP' }] })
  })
})

describe('selective write-plan binding', () => {
  it('binds selection, projection, sources, output state, and complete artifacts deterministically', async () => {
    const context = await fixture()
    const plans = store()
    try {
      const left = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser', 'createUser'] })
      const right = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser', 'getUser'] })
      expect(left.stored.planHash).toBe(right.stored.planHash)
      expect(left.stored.deterministic).toMatchObject({
        kind: 'selective',
        target: 'main',
        selection: {
          requestedOperationKeys: ['createUser', 'getUser'],
          desiredOperationKeys: ['createUser', 'getUser'],
          previousSelectionExists: false,
          selectionFileSnapshot: { exists: false },
          desiredSelectionBytes: expect.any(Number),
          desiredSelectionBytesSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          projection: { operationCount: 2 },
        },
        output: { artifacts: [{ path: 'createUser.txt' }, { path: 'getUser.txt' }] },
      })
      expect(left.stored.deterministic.sources.length).toBeGreaterThan(0)
      expect(left.stored.deterministic.output.ownershipManifest).toEqual({ exists: false })
    } finally {
      plans.clear()
    }
  })

  it('changes the semantic plan hash when selection or projected artifacts change', async () => {
    const context = await fixture()
    const plans = store()
    try {
      const one = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      const two = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser', 'createUser'] })
      expect(one.stored.planHash).not.toBe(two.stored.planHash)
      expect(one.stored.deterministic.selection?.projectionHash).not.toBe(two.stored.deterministic.selection?.projectionHash)
      expect(one.stored.deterministic.output.artifacts).not.toEqual(two.stored.deterministic.output.artifacts)
      const artifactChanged = structuredClone(one.stored.deterministic)
      if (!artifactChanged.output.artifacts[0]) throw new Error('Expected a generated artifact binding.')
      artifactChanged.output.artifacts[0].sha256 = 'f'.repeat(64)
      expect(hashDeterministicGenerationPlan(artifactChanged)).not.toBe(one.stored.planHash)
      const projectionChanged = structuredClone(one.stored.deterministic)
      if (!projectionChanged.selection) throw new Error('Expected a selective projection binding.')
      projectionChanged.selection.projectionHash = 'e'.repeat(64)
      expect(hashDeterministicGenerationPlan(projectionChanged)).not.toBe(one.stored.planHash)
    } finally {
      plans.clear()
    }
  })

  it('binds full and selective tokens to distinct plan kinds and authorization contexts', async () => {
    const context = await fixture()
    const plans = store()
    try {
      const full = await prepareGenerationWritePlan(context.provider, plans, context.resolved, ['main'])
      const selective = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      expect(full.stored.authorizationContextHash).not.toBe(selective.stored.authorizationContextHash)
      expect(() => plans.verify(full.stored.planId, selective.token, full.stored.planHash)).toThrow(/token/i)
      expect(() => plans.verify(selective.stored.planId, full.token, selective.stored.planHash)).toThrow(/token/i)
      expect(plans.verify(full.stored.planId, full.token, full.stored.planHash).kind).toBe('full')
      expect(plans.verify(selective.stored.planId, selective.token, selective.stored.planHash).kind).toBe('selective')
    } finally {
      plans.clear()
    }
  })

  it.each([
    ['projection', 'SELECTIVE_APPLY_PROJECTION_MISMATCH', (plan: InternalGenerationWritePlan) => {
      if (!plan.deterministic.selection) throw new Error('Expected a selective projection binding.')
      plan.deterministic.selection.projectionHash = 'f'.repeat(64)
    }],
  ] as const)('rejects selective %s mismatch before transaction commit', async (_kind, expectedCode, mutate) => {
    const context = await fixture()
    const plans = store()
    try {
      const prepared = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      mutate(prepared.stored)
      const result = await applyGenerationTool({
        options: context.resolved,
        trustedConfig: context.provider,
        generationPlans: plans,
        targetCatalogs: context.registry,
        generationLock: { async run(operation: () => Promise<unknown>) { return operation() } } as never,
        logger: { debug() {}, info() {}, warn() {}, error() {} },
      }, {
        planId: prepared.stored.planId,
        token: prepared.token,
        approvedPlanHash: prepared.stored.planHash,
      })
      expect(result.isError).toBe(true)
      expect((result.structuredContent?.diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain(expectedCode)
      await expect(access(path.join(context.root, '.OpenAPI/generated/getUser.txt'))).rejects.toThrow()
      await expect(access(prepared.selection.selectionFile)).rejects.toThrow()
    } finally {
      plans.clear()
    }
  })

  it('binds the exact prior physical snapshot and desired serialized bytes', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await mkdir(path.dirname(initial.selectionFile), { recursive: true })
    await writeFile(initial.selectionFile, serializeOperationSelectionManifest({ ...initial.merge.manifest, metadata: { updatedAt: '2026-01-01T00:00:00Z' } }))
    const plans = store()
    try {
      const first = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] })
      await writeFile(initial.selectionFile, serializeOperationSelectionManifest({ ...initial.merge.manifest, metadata: { updatedAt: '2030-01-01T00:00:00Z', lastAppliedSpecHash: 'changed-audit-only' } }))
      const metadataChanged = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] })
      const requestChanged = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser', 'createUser'] })
      expect(metadataChanged.stored.planHash).not.toBe(first.stored.planHash)
      expect(metadataChanged.stored.deterministic.selection?.selectionFileSnapshot).not.toEqual(first.stored.deterministic.selection?.selectionFileSnapshot)
      expect(metadataChanged.stored.deterministic.selection?.desiredSelectionBytesSha256).not.toBe(first.stored.deterministic.selection?.desiredSelectionBytesSha256)
      expect(requestChanged.selection.merge.desiredOperationKeys).toEqual(first.selection.merge.desiredOperationKeys)
      expect(requestChanged.stored.planHash).not.toBe(first.stored.planHash)
    } finally {
      plans.clear()
    }
  })

  it('keeps valid historical operations while a restarted catalog binds changed source and projection identity', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await persistSelection(initial)
    const plans = store()
    try {
      const before = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      const sourcePath = path.join(context.root, 'openapi.yaml')
      await writeFile(sourcePath, (await readFile(sourcePath, 'utf8')).replace('title: Selection', 'title: Selection Changed'))
      const restartedRegistry = new TrustedTargetCatalogRegistry(context.provider, context.resolved)
      const after = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, restartedRegistry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      expect(after.selection.merge.desiredOperationKeys).toEqual(['getUser'])
      expect(after.stored.deterministic.sources).not.toEqual(before.stored.deterministic.sources)
      expect(after.stored.deterministic.selection?.projectionHash).not.toBe(before.stored.deterministic.selection?.projectionHash)
      expect(after.stored.planHash).not.toBe(before.stored.planHash)
    } finally {
      plans.clear()
    }
  })

  it('generates the complete desired union and never drops artifacts for previous operations', async () => {
    const context = await fixture()
    const initial = await prepareOperationSelection(context.provider, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
    await persistSelection(initial)
    const plans = store()
    try {
      const prepared = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['createUser'] })
      expect(prepared.selection.merge.desiredOperationKeys).toEqual(['createUser', 'getUser'])
      expect(prepared.run.selection?.resolvedOperationKeys).toEqual(['createUser', 'getUser'])
      expect(prepared.run.servers[0]?.materialized.map(({ relativePath }) => relativePath)).toEqual(['createUser.txt', 'getUser.txt'])
      expect(prepared.run.servers[0]?.result.generationResult?.manifest.summary.deleted).toBe(0)
    } finally {
      plans.clear()
    }
  })

  it('keeps selective plans active after verification and before Apply consumes them', async () => {
    const context = await fixture()
    const plans = store()
    try {
      const prepared = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      const input = { planId: prepared.stored.planId, token: prepared.token, approvedPlanHash: prepared.stored.planHash }
      expect(assertGenerationPlanApplySupported(plans, input)).toBe(prepared.stored)
      expect(plans.verify(input.planId, input.token, input.approvedPlanHash)).toBe(prepared.stored)
      await expect(access(path.join(context.root, '.OpenAPI/generated'))).rejects.toThrow()
      await expect(access(prepared.selection.selectionFile)).rejects.toThrow()
      await expect(access(path.join(context.root, '.OpenAPI/generated/.openapi-to-write.lock'))).rejects.toThrow()
      await expect(access(path.join(context.root, '.OpenAPI/generated/.openapi-to-transaction'))).rejects.toThrow()
    } finally {
      plans.clear()
    }
  })

  it('applies a valid selective plan through the Tool handler and consumes it once', async () => {
    const context = await fixture()
    const plans = store()
    let queueEntries = 0
    try {
      const prepared = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      const result = await applyGenerationTool({
        options: context.resolved,
        trustedConfig: context.provider,
        generationPlans: plans,
        targetCatalogs: context.registry,
        generationLock: { async run(operation: () => Promise<unknown>) { queueEntries += 1; return operation() } } as never,
        logger: { debug() {}, info() {}, warn() {}, error() {} },
      }, {
        planId: prepared.stored.planId,
        token: prepared.token,
        approvedPlanHash: prepared.stored.planHash,
      })
      expect(queueEntries).toBe(1)
      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toMatchObject({ success: true, applied: true, planKind: 'selective', selectionApplied: true, selectedOperationCount: 1 })
      expect(() => plans.verify(prepared.stored.planId, prepared.token, prepared.stored.planHash)).toThrow(/already/i)
      expect(await readFile(path.join(context.root, '.OpenAPI/generated/getUser.txt'), 'utf8')).toBe('getUser\n')
      expect(await readFile(prepared.selection.selectionFile, 'utf8')).toBe(prepared.selection.desiredSelectionBytes)
    } finally {
      plans.clear()
    }
  })

  it('rolls back all three selective states after a real Apply-path transaction failure', async () => {
    const context = await fixture()
    const plans = store()
    const logger = { debug() {}, info() {}, warn() {}, error() {} }
    try {
      const prepared = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      await expect(applyGenerationWritePlan(
        context.provider,
        plans,
        context.resolved,
        context.registry,
        { planId: prepared.stored.planId, token: prepared.token, approvedPlanHash: prepared.stored.planHash },
        logger,
        { transactionFailpoint: 'state-after-rename' },
      )).rejects.toMatchObject({ name: 'OutputTransactionRolledBackError' })
      await expect(access(path.join(context.root, '.OpenAPI/generated/getUser.txt'))).rejects.toThrow()
      await expect(access(path.join(context.root, '.OpenAPI/generated/.openapi-to-manifest.json'))).rejects.toThrow()
      await expect(access(prepared.selection.selectionFile)).rejects.toThrow()
      await expect(access(path.join(context.root, '.OpenAPI/generated/.openapi-to-transaction.json'))).rejects.toThrow()
      expect(() => plans.verify(prepared.stored.planId, prepared.token, prepared.stored.planHash)).toThrow(/already/i)

      const fresh = await prepareSelectiveGenerationWritePlan(context.provider, plans, context.resolved, context.registry, ['main'], { type: 'add', operationKeys: ['getUser'] })
      const applied = await applyGenerationWritePlan(
        context.provider,
        plans,
        context.resolved,
        context.registry,
        { planId: fresh.stored.planId, token: fresh.token, approvedPlanHash: fresh.stored.planHash },
        logger,
      )
      expect(applied).toMatchObject({ selectionApplied: true, selectedOperationCount: 1 })
    } finally {
      plans.clear()
    }
  })
})
