import { access, mkdir, mkdtemp, readFile, symlink, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { ARTIFACT_MANIFEST_FILENAME, compareArtifacts, hashArtifactContent, materializeArtifacts, sourceFileToArtifact, writeArtifacts } from './index.ts'

describe('generated artifacts', () => {
  it('materializes and compares multiple artifact kinds', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-artifacts-'))
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('/virtual/example.ts', 'export const value=1')
    sourceFile.replaceWithText('export const value=1')
    const materialized = materializeArtifacts([
      { kind: 'text', path: 'readme.md', content: '# Generated\n' },
      { kind: 'json', path: 'data.json', value: { b: 2, a: 1 } },
      { kind: 'typescript', path: path.join(root, 'example.ts'), sourceFile },
      { kind: 'binary', path: 'asset.bin', content: new Uint8Array([0, 1, 2]) },
    ], root)
    expect(materialized.diagnostics).toEqual([])
    expect(new TextDecoder().decode(materialized.artifacts.find((artifact) => artifact.relativePath === 'data.json')?.content ?? new Uint8Array())).toBe('{\n  "a": 1,\n  "b": 2\n}\n')
    const manifest = await compareArtifacts(materialized.artifacts, root)
    expect(manifest.summary.added).toBe(4)
    await writeArtifacts(materialized.artifacts, manifest)
    await writeFile(path.join(root, 'stale.txt'), 'stale')
    const next = await compareArtifacts(materialized.artifacts, root, true)
    expect(next.summary).toMatchObject({ unchanged: 4, deleted: 0 })
    expect(await readFile(path.join(root, 'stale.txt'), 'utf8')).toBe('stale')
    expect(hashArtifactContent(materialized.artifacts[0]?.content ?? new Uint8Array())).toMatch(/^[a-f0-9]{64}$/)
    const ownership = JSON.parse(await readFile(path.join(root, ARTIFACT_MANIFEST_FILENAME), 'utf8'))
    expect(ownership.version).toBe(2)
    expect(ownership.files.map(({ path: managedPath }: { path: string }) => managedPath)).toEqual(['asset.bin', 'data.json', 'example.ts', 'readme.md'])
  })

  it('deduplicates identical paths and rejects traversal, size, case, and content conflicts', () => {
    const root = path.resolve('/tmp/output')
    const result = materializeArtifacts([
      { kind: 'text', path: '../escape.txt', content: 'x' },
      { kind: 'text', path: path.resolve('/tmp/escape.txt'), content: 'x' },
      { kind: 'text', path: 'same.txt', content: 'a', plugin: 'a' },
      { kind: 'text', path: 'same.txt', content: 'a', plugin: 'a-copy' },
      { kind: 'text', path: 'same.txt', content: 'b', plugin: 'b' },
      { kind: 'text', path: 'Case.txt', content: 'c' },
      { kind: 'text', path: 'case.txt', content: 'c' },
      { kind: 'binary', path: 'large.bin', content: new Uint8Array([1, 2, 3, 4]) },
    ], root, { maxArtifactBytes: 3 })
    expect(result.artifacts.filter((artifact) => artifact.relativePath === 'same.txt')).toHaveLength(1)
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      'ARTIFACT_PATH_OUTSIDE_OUTPUT',
      'ARTIFACT_PATH_CONFLICT',
      'ARTIFACT_PATH_CASE_CONFLICT',
      'ARTIFACT_TOO_LARGE',
    ]))
  })

  it('deletes only previously managed files when clean is enabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-clean-'))
    await writeFile(path.join(root, 'user.txt'), 'keep')
    const first = materializeArtifacts([{ kind: 'text', path: 'generated.txt', content: 'generated' }], root)
    const firstManifest = await compareArtifacts(first.artifacts, root, true)
    expect(firstManifest.entries.map((entry) => entry.path)).toEqual(['generated.txt'])
    await writeArtifacts(first.artifacts, firstManifest)

    const secondManifest = await compareArtifacts([], root, true)
    expect(secondManifest.entries).toEqual([
      expect.objectContaining({ path: 'generated.txt', status: 'deleted', previousHash: expect.stringMatching(/^[a-f0-9]{64}$/), bytes: 9 }),
    ])
    await writeArtifacts([], secondManifest)
    await expect(access(path.join(root, 'generated.txt'))).rejects.toThrow()
    await expect(access(path.join(root, ARTIFACT_MANIFEST_FILENAME))).rejects.toThrow()
    expect(await readFile(path.join(root, 'user.txt'), 'utf8')).toBe('keep')
  })

  it('does not create ownership state for an empty no-op write', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-empty-'))
    const manifest = await compareArtifacts([], root)
    await writeArtifacts([], manifest)
    await expect(access(path.join(root, ARTIFACT_MANIFEST_FILENAME))).rejects.toThrow()
  })

  it('rejects output-root and nested symlink escapes for writes and deletes', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'openapi-symlink-'))
    const outside = path.join(parent, 'outside')
    const rootLink = path.join(parent, 'root-link')
    await mkdir(outside)
    await symlink(outside, rootLink, process.platform === 'win32' ? 'junction' : 'dir')
    const linkedRootArtifact = materializeArtifacts([{ kind: 'text', path: 'escape.txt', content: 'no' }], rootLink)
    await expect(compareArtifacts(linkedRootArtifact.artifacts, rootLink)).rejects.toThrow(/symlink/)

    const root = path.join(parent, 'root')
    await mkdir(root)
    await writeFile(path.join(outside, 'victim.txt'), 'keep')
    await symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await writeFile(path.join(root, ARTIFACT_MANIFEST_FILENAME), `${JSON.stringify({ version: 1, files: ['linked/victim.txt'] })}\n`)
    const deletion = await compareArtifacts([], root, true)
    await expect(writeArtifacts([], deletion)).rejects.toThrow(/symlink/)
    expect(await readFile(path.join(outside, 'victim.txt'), 'utf8')).toBe('keep')
  })

  it('keeps the legacy SourceFile adapter deterministic', () => {
    const root = path.resolve('/tmp/source-adapter')
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(path.join(root, 'legacy.ts'), 'export const x=1')
    const first = materializeArtifacts([sourceFileToArtifact(sourceFile)], root)
    const second = materializeArtifacts([sourceFileToArtifact(sourceFile)], root)
    expect(first.artifacts[0]?.hash).toBe(second.artifacts[0]?.hash)
  })

  it('fails closed when an existing generated file changes during comparison', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-compare-race-'))
    const file = path.join(root, 'large.txt')
    await writeFile(file, 'x'.repeat(8 * 1024 * 1024))
    const expected = materializeArtifacts([{ kind: 'text', path: 'large.txt', content: 'expected' }], root)
    const timer = setInterval(() => { void utimes(file, new Date(), new Date()) }, 1)
    await expect(compareArtifacts(expected.artifacts, root)).rejects.toMatchObject({ name: 'ArtifactComparisonChangedError' })
    clearInterval(timer)
  })

  it('fails closed when the ownership manifest changes during comparison', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-manifest-race-'))
    const manifestPath = path.join(root, ARTIFACT_MANIFEST_FILENAME)
    await writeFile(manifestPath, `${JSON.stringify({ version: 1, files: [], padding: 'x'.repeat(8 * 1024 * 1024) })}\n`)
    const timer = setInterval(() => { void utimes(manifestPath, new Date(), new Date()) }, 1)
    await expect(compareArtifacts([], root, true)).rejects.toMatchObject({ name: 'ArtifactComparisonChangedError' })
    clearInterval(timer)
  })
})
