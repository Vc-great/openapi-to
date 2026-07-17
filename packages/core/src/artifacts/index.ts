import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { execa } from 'execa'
import type { SourceFile, ts } from 'ts-morph'
import { sortDiagnostics, type Diagnostic } from '../diagnostics.ts'
import type { GeneratedArtifact, GenerationManifest, GenerationManifestEntry, MaterializeArtifactOptions, MaterializedArtifact } from './types.ts'

export * from './types.ts'

const encoder = new TextEncoder()
export const ARTIFACT_MANIFEST_FILENAME = '.openapi-to-manifest.json'
export const DEFAULT_MAX_ARTIFACT_BYTES = 64 * 1024 * 1024

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function hashArtifactContent(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function stableJSONValue(value: unknown, seen: Set<object>): unknown {
  if (Array.isArray(value)) return value.map((item) => stableJSONValue(item, seen))
  if (typeof value !== 'object' || value === null) return value
  if (seen.has(value)) throw new TypeError('Cannot serialize cyclic JSON artifact.')
  seen.add(value)
  const result = Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stableJSONValue((value as Record<string, unknown>)[key], seen)]))
  seen.delete(value)
  return result
}

export function stableJSONStringify(value: unknown): string {
  const serialized = JSON.stringify(stableJSONValue(value, new Set()), null, 2)
  if (serialized === undefined) throw new TypeError('JSON artifact value is not serializable.')
  return `${serialized}\n`
}

export function normalizeArtifactPath(outputRoot: string, artifactPath: string): { absolutePath?: string; relativePath?: string; diagnostic?: Diagnostic } {
  const root = path.resolve(outputRoot)
  const absolutePath = path.resolve(path.isAbsolute(artifactPath) ? artifactPath : path.join(root, artifactPath))
  const relativePath = path.relative(root, absolutePath)
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    return {
      diagnostic: {
        code: 'ARTIFACT_PATH_OUTSIDE_OUTPUT',
        severity: 'error',
        message: `Generated artifact path escapes the output root: ${artifactPath}`,
        location: { source: artifactPath },
      },
    }
  }
  return { absolutePath, relativePath: relativePath.split(path.sep).join('/') }
}

const tsFormatSettings = {
  indentSize: 2,
  indentStyle: 2 as ts.IndentStyle,
  convertTabsToSpaces: true,
  newLineCharacter: '\n',
  quoteKind: 'single',
  useTrailingCommas: true,
  insertSpaceAfterCommaDelimiter: true,
  insertSpaceBeforeFunctionParenthesis: false,
  insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
  insertSpaceAfterSemicolonInForStatements: true,
  insertSpaceBeforeTypeAnnotation: false,
  placeOpenBraceOnNewLineForFunctions: false,
  placeOpenBraceOnNewLineForControlBlocks: false,
  semicolons: 'insert' as ts.SemicolonPreference,
} as const

export function sourceFileToArtifact(sourceFile: SourceFile, plugin?: string): GeneratedArtifact {
  return { kind: 'typescript', path: sourceFile.getFilePath(), sourceFile, plugin }
}

export function sortGeneratedArtifacts(artifacts: readonly GeneratedArtifact[]): GeneratedArtifact[] {
  return [...artifacts].sort((left, right) => {
    return (
      compareStrings(left.path.replaceAll('\\', '/'), right.path.replaceAll('\\', '/')) ||
      compareStrings(left.plugin ?? '', right.plugin ?? '') ||
      compareStrings(left.kind, right.kind)
    )
  })
}

export function materializeArtifacts(
  artifacts: readonly GeneratedArtifact[],
  outputRoot: string,
  options: MaterializeArtifactOptions = {},
): { artifacts: MaterializedArtifact[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  const byPath = new Map<string, MaterializedArtifact>()
  const byFoldedPath = new Map<string, string>()
  const maxArtifactBytes = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES
  for (const artifact of sortGeneratedArtifacts(artifacts)) {
    const normalized = normalizeArtifactPath(outputRoot, artifact.path)
    if (!normalized.absolutePath || !normalized.relativePath) {
      if (normalized.diagnostic) diagnostics.push(normalized.diagnostic)
      continue
    }
    if (normalized.relativePath === ARTIFACT_MANIFEST_FILENAME) {
      diagnostics.push({
        code: 'ARTIFACT_PATH_RESERVED',
        severity: 'error',
        message: `${ARTIFACT_MANIFEST_FILENAME} is reserved for the generated-output ownership manifest.`,
        location: { source: artifact.path },
        plugin: artifact.plugin,
      })
      continue
    }
    const foldedPath = normalized.relativePath.toLowerCase()
    const caseVariant = byFoldedPath.get(foldedPath)
    if (caseVariant && caseVariant !== normalized.relativePath) {
      diagnostics.push({
        code: 'ARTIFACT_PATH_CASE_CONFLICT',
        severity: 'error',
        message: `Generated artifact paths differ only by case: ${caseVariant} and ${normalized.relativePath}.`,
        location: { source: normalized.relativePath },
        plugin: artifact.plugin,
      })
      continue
    }
    let content: Uint8Array
    try {
      if (artifact.kind === 'typescript') {
        artifact.sourceFile.formatText(tsFormatSettings)
        content = encoder.encode(artifact.sourceFile.getFullText())
      } else if (artifact.kind === 'text') content = encoder.encode(artifact.content)
      else if (artifact.kind === 'json') content = encoder.encode(stableJSONStringify(artifact.value))
      else content = artifact.content
    } catch (error) {
      diagnostics.push({ code: 'ARTIFACT_SERIALIZATION_FAILED', severity: 'error', message: `Unable to serialize generated artifact ${artifact.path}.`, location: { source: artifact.path }, cause: error instanceof Error ? error.message : undefined, plugin: artifact.plugin })
      continue
    }
    if (content.byteLength > maxArtifactBytes) {
      diagnostics.push({
        code: 'ARTIFACT_TOO_LARGE',
        severity: 'error',
        message: `Generated artifact ${normalized.relativePath} exceeds the ${maxArtifactBytes} byte limit.`,
        location: { source: normalized.relativePath },
        plugin: artifact.plugin,
      })
      continue
    }
    const materialized: MaterializedArtifact = {
      kind: artifact.kind,
      path: normalized.absolutePath,
      relativePath: normalized.relativePath,
      content,
      hash: hashArtifactContent(content),
      plugin: artifact.plugin,
    }
    const previous = byPath.get(normalized.relativePath)
    if (previous && previous.hash !== materialized.hash) {
      diagnostics.push({
        code: 'ARTIFACT_PATH_CONFLICT',
        severity: 'error',
        message: `Multiple plugins generated different content for ${normalized.relativePath}.`,
        location: { source: normalized.relativePath },
        hint: [previous.plugin, materialized.plugin].filter(Boolean).length ? `Producers: ${[previous.plugin, materialized.plugin].filter(Boolean).join(', ')}` : undefined,
      })
      continue
    }
    if (!previous) {
      byPath.set(normalized.relativePath, materialized)
      byFoldedPath.set(foldedPath, normalized.relativePath)
    }
  }
  return { artifacts: [...byPath.values()].sort((a, b) => compareStrings(a.relativePath, b.relativePath)), diagnostics: sortDiagnostics(diagnostics) }
}

export async function formatMaterializedArtifacts(
  artifacts: readonly MaterializedArtifact[],
  formatter?: 'biome',
): Promise<{ artifacts: MaterializedArtifact[]; diagnostics: Diagnostic[] }> {
  if (!formatter) return { artifacts: [...artifacts], diagnostics: [] }
  const diagnostics: Diagnostic[] = []
  const formatted: MaterializedArtifact[] = []
  for (const artifact of artifacts) {
    if (artifact.kind === 'binary') {
      formatted.push(artifact)
      continue
    }
    try {
      const result = await execa('biome', ['format', '--stdin-file-path', artifact.path], {
        input: new TextDecoder().decode(artifact.content),
        reject: true,
      })
      const content = encoder.encode(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`)
      formatted.push({ ...artifact, content, hash: hashArtifactContent(content) })
    } catch (error) {
      diagnostics.push({
        code: 'FORMATTER_FAILED',
        severity: 'warning',
        message: `Biome could not format ${artifact.relativePath}; the deterministic built-in serialization was retained.`,
        location: { source: artifact.path },
        cause: error instanceof Error ? error.message : undefined,
      })
      formatted.push(artifact)
    }
  }
  return { artifacts: formatted, diagnostics: sortDiagnostics(diagnostics) }
}

async function readManagedPaths(root: string): Promise<string[]> {
  try {
    const manifestPath = path.join(root, ARTIFACT_MANIFEST_FILENAME)
    await assertNoSymlinkSegments(root, manifestPath)
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1 || !Array.isArray((parsed as { files?: unknown }).files)) {
      throw new Error(`Invalid generated-output ownership manifest: ${path.join(root, ARTIFACT_MANIFEST_FILENAME)}`)
    }
    const result = new Set<string>()
    const folded = new Set<string>()
    for (const value of (parsed as { files: unknown[] }).files) {
      if (typeof value !== 'string') throw new Error(`Invalid managed artifact path in ${ARTIFACT_MANIFEST_FILENAME}.`)
      const normalized = normalizeArtifactPath(root, value)
      if (!normalized.relativePath || normalized.relativePath !== value || value === ARTIFACT_MANIFEST_FILENAME) {
        throw new Error(`Unsafe managed artifact path in ${ARTIFACT_MANIFEST_FILENAME}: ${value}`)
      }
      const foldedPath = value.toLowerCase()
      if (result.has(value) || folded.has(foldedPath)) throw new Error(`Duplicate managed artifact path in ${ARTIFACT_MANIFEST_FILENAME}: ${value}`)
      result.add(value)
      folded.add(foldedPath)
    }
    return [...result].sort(compareStrings)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function compareArtifacts(artifacts: readonly MaterializedArtifact[], outputRoot: string, includeDeletes = false): Promise<GenerationManifest> {
  const root = path.resolve(outputRoot)
  const entries: GenerationManifestEntry[] = []
  const expected = new Set(artifacts.map((artifact) => artifact.relativePath))
  for (const artifact of artifacts) {
    try {
      await assertNoSymlinkSegments(root, artifact.path)
      const previous = new Uint8Array(await readFile(artifact.path))
      const previousHash = hashArtifactContent(previous)
      entries.push({ path: artifact.relativePath, status: previousHash === artifact.hash ? 'unchanged' : 'modified', hash: artifact.hash, previousHash, bytes: artifact.content.byteLength })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      entries.push({ path: artifact.relativePath, status: 'added', hash: artifact.hash, bytes: artifact.content.byteLength })
    }
  }
  if (includeDeletes) {
    for (const relativePath of await readManagedPaths(root)) {
      if (!expected.has(relativePath)) entries.push({ path: relativePath, status: 'deleted' })
    }
  }
  entries.sort((a, b) => compareStrings(a.path, b.path) || compareStrings(a.status, b.status))
  const summary: GenerationManifest['summary'] = { added: 0, modified: 0, deleted: 0, unchanged: 0 }
  for (const entry of entries) summary[entry.status] += 1
  return { outputRoot: root, entries, summary, outdated: summary.added + summary.modified + summary.deleted > 0 }
}

export async function writeArtifacts(artifacts: readonly MaterializedArtifact[], manifest: GenerationManifest): Promise<void> {
  const byPath = new Map(artifacts.map((artifact) => [artifact.relativePath, artifact]))
  for (const entry of manifest.entries) {
    if (entry.status === 'unchanged') continue
    const absolutePath = path.resolve(manifest.outputRoot, entry.path)
    const normalized = normalizeArtifactPath(manifest.outputRoot, absolutePath)
    if (!normalized.absolutePath) throw new Error(`Refusing to write outside output root: ${entry.path}`)
    if (entry.status === 'deleted') {
      await assertNoSymlinkSegments(manifest.outputRoot, path.dirname(normalized.absolutePath))
      await rm(normalized.absolutePath, { force: true })
      continue
    }
    const artifact = byPath.get(entry.path)
    if (!artifact) throw new Error(`Missing materialized artifact for ${entry.path}`)
    await assertNoSymlinkSegments(manifest.outputRoot, artifact.path)
    await mkdir(path.dirname(artifact.path), { recursive: true })
    await writeFile(artifact.path, artifact.content)
  }
  if (artifacts.length > 0) {
    await writeOwnershipManifest(manifest.outputRoot, artifacts.map((artifact) => artifact.relativePath))
  } else if (manifest.entries.some((entry) => entry.status === 'deleted')) {
    const ownershipManifest = path.join(path.resolve(manifest.outputRoot), ARTIFACT_MANIFEST_FILENAME)
    await assertNoSymlinkSegments(manifest.outputRoot, ownershipManifest)
    await rm(ownershipManifest, { force: true })
  }
}

async function assertNoSymlinkSegments(outputRoot: string, artifactPath: string): Promise<void> {
  const root = path.resolve(outputRoot)
  const relative = path.relative(root, path.resolve(artifactPath))
  let current = root
  try {
    const rootStat = await lstat(current)
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`Output root must be a real directory, not a symlink: ${current}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing to write through symlinked output path: ${current}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
  }
}

async function writeOwnershipManifest(outputRoot: string, relativePaths: string[]): Promise<void> {
  const root = path.resolve(outputRoot)
  const manifestPath = path.join(root, ARTIFACT_MANIFEST_FILENAME)
  await assertNoSymlinkSegments(root, manifestPath)
  await mkdir(root, { recursive: true })
  const files = [...new Set(relativePaths)].sort(compareStrings)
  await writeFile(manifestPath, `${JSON.stringify({ version: 1, files }, null, 2)}\n`)
}
