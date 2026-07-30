import { describe, expect, it } from 'vitest'

import {
  applyOperationSelectionMutation,
  createEmptyOperationSelection,
  hashOperationSelection,
  mergeOperationSelection,
  normalizeOperationSelection,
  parseOperationSelectionManifest,
  serializeOperationSelectionManifest,
  validateOperationSelectionManifest,
} from './selection.ts'

const target = 'backend'
const owner = 'config:.openapi-to/openapi.config.ts|target:backend|output:.openapi-to/sdk'

describe('operation selection manifest', () => {
  it('creates and deterministically serializes empty and populated version 1 manifests', () => {
    expect(createEmptyOperationSelection(target, owner)).toEqual({ version: 1, target, selectionOwner: owner, operations: [] })
    const manifest = normalizeOperationSelection(target, owner, ['updateUser', 'getUser', 'getUser'])
    expect(manifest.operations).toEqual(['getUser', 'updateUser'])
    expect(serializeOperationSelectionManifest(manifest)).toBe(`${JSON.stringify(manifest, null, 2)}\n`)
  })

  it('keeps semantic hashes stable across ordering and non-semantic metadata', () => {
    const left = normalizeOperationSelection(target, owner, ['B', 'A'], { updatedAt: '2026-01-01', lastAppliedSpecHash: 'old' })
    const right = normalizeOperationSelection(target, owner, ['A', 'B'], { updatedAt: '2030-01-01', lastAppliedSpecHash: 'new' })
    expect(hashOperationSelection(left)).toBe(hashOperationSelection(right))
    expect(hashOperationSelection(normalizeOperationSelection(target, owner, ['A']))).not.toBe(hashOperationSelection(right))
  })

  it('parses a strict valid manifest and rejects malformed, unknown-version, unknown-field, and invalid operations', () => {
    const valid = parseOperationSelectionManifest(JSON.stringify({ version: 1, target, selectionOwner: owner, operations: ['B', 'A'] }), {
      expectedTarget: target,
      expectedSelectionOwner: owner,
    })
    expect(valid.manifest?.operations).toEqual(['A', 'B'])
    expect(parseOperationSelectionManifest('{').diagnostics[0]?.code).toBe('SELECTION_MANIFEST_INVALID')
    expect(validateOperationSelectionManifest({ version: 2, target, selectionOwner: owner, operations: [] }).diagnostics.map(({ code }) => code)).toContain('SELECTION_MANIFEST_VERSION_UNSUPPORTED')
    expect(validateOperationSelectionManifest({ version: 1, target, selectionOwner: owner, operations: [], extra: true }).diagnostics[0]?.code).toBe('SELECTION_MANIFEST_INVALID')
    for (const operations of [['A', 'A'], [''], [1]]) {
      expect(validateOperationSelectionManifest({ version: 1, target, selectionOwner: owner, operations }).manifest).toBeUndefined()
    }
  })

  it('enforces byte/count limits and trusted target/owner identity', () => {
    expect(parseOperationSelectionManifest('{}'.repeat(100), { maxBytes: 10 }).diagnostics[0]?.code).toBe('SELECTION_MANIFEST_TOO_LARGE')
    expect(validateOperationSelectionManifest({ version: 1, target, selectionOwner: owner, operations: ['A', 'B'] }, { maxOperations: 1 }).diagnostics[0]?.code).toBe('SELECTION_MANIFEST_TOO_LARGE')
    expect(validateOperationSelectionManifest({ version: 1, target: 'other', selectionOwner: owner, operations: [] }, { expectedTarget: target }).diagnostics.map(({ code }) => code)).toContain('SELECTION_TARGET_MISMATCH')
    expect(validateOperationSelectionManifest({ version: 1, target, selectionOwner: 'other', operations: [] }, { expectedSelectionOwner: owner }).diagnostics.map(({ code }) => code)).toContain('SELECTION_OWNER_MISMATCH')
  })
})

describe('operation selection add mutation', () => {
  it.each([
    [[], ['A'], ['A']],
    [['A'], ['B'], ['A', 'B']],
    [['A'], ['A'], ['A']],
    [['A', 'B'], ['B', 'C'], ['A', 'B', 'C']],
  ])('merges %j + %j into %j', (previous, requested, desired) => {
    expect(mergeOperationSelection(normalizeOperationSelection(target, owner, previous), { type: 'add', operationKeys: requested }).desiredOperationKeys).toEqual(desired)
  })

  it('normalizes request order and reports newly added versus already selected keys', () => {
    const first = mergeOperationSelection(normalizeOperationSelection(target, owner, ['B', 'A']), { type: 'add', operationKeys: ['C', 'B', 'C'] })
    const second = mergeOperationSelection(normalizeOperationSelection(target, owner, ['A', 'B']), { type: 'add', operationKeys: ['B', 'C'] })
    expect(first).toMatchObject({
      mutationType: 'add',
      previousOperationKeys: ['A', 'B'],
      requestedOperationKeys: ['B', 'C'],
      newlyAddedOperationKeys: ['C'],
      alreadySelectedOperationKeys: ['B'],
      retainedOperationKeys: ['A', 'B'],
      removedOperationKeys: [],
      desiredOperationKeys: ['A', 'B', 'C'],
    })
    expect(hashOperationSelection(first.manifest)).toBe(hashOperationSelection(second.manifest))
  })
})

describe('operation selection replace mutation', () => {
  it('normalizes an exact desired set and reports added, retained, and removed keys', () => {
    const result = applyOperationSelectionMutation(
      normalizeOperationSelection(target, owner, ['B', 'A']),
      { type: 'replace', operationKeys: ['C', 'B', 'C'] },
    )
    expect(result).toMatchObject({
      mutationType: 'replace',
      previousOperationKeys: ['A', 'B'],
      requestedOperationKeys: ['B', 'C'],
      newlyAddedOperationKeys: ['C'],
      alreadySelectedOperationKeys: ['B'],
      retainedOperationKeys: ['B'],
      removedOperationKeys: ['A'],
      desiredOperationKeys: ['B', 'C'],
      manifest: { operations: ['B', 'C'] },
    })
  })

  it('is semantically stable for the same set and remains available through the legacy merge entry point', () => {
    const previous = normalizeOperationSelection(target, owner, ['B', 'A'])
    const mutation = { type: 'replace' as const, operationKeys: ['A', 'B', 'A'] }
    const direct = applyOperationSelectionMutation(previous, mutation)
    const compatible = mergeOperationSelection(previous, mutation)
    expect(compatible).toEqual(direct)
    expect(direct).toMatchObject({
      newlyAddedOperationKeys: [],
      alreadySelectedOperationKeys: ['A', 'B'],
      retainedOperationKeys: ['A', 'B'],
      removedOperationKeys: [],
      desiredOperationKeys: ['A', 'B'],
    })
    expect(hashOperationSelection(direct.manifest)).toBe(hashOperationSelection(previous))
  })

  it('rejects an empty replace instead of treating it as clear', () => {
    expect(() => applyOperationSelectionMutation(
      normalizeOperationSelection(target, owner, ['A']),
      { type: 'replace', operationKeys: [] },
    )).toThrow(/clear is not supported/i)
  })
})
