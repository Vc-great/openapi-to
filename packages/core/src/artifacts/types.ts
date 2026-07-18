import type { SourceFile } from 'ts-morph'
import type { Diagnostic } from '../diagnostics.ts'

export type GeneratedArtifact =
  | { kind: 'typescript'; path: string; sourceFile: SourceFile; plugin?: string }
  | { kind: 'text'; path: string; content: string; plugin?: string }
  | { kind: 'json'; path: string; value: unknown; plugin?: string }
  | { kind: 'binary'; path: string; content: Uint8Array; plugin?: string }

export type ArtifactStatus = 'added' | 'modified' | 'deleted' | 'unchanged'

export interface MaterializedArtifact {
  kind: GeneratedArtifact['kind']
  path: string
  relativePath: string
  content: Uint8Array
  hash: string
  plugin?: string
}

export interface GenerationManifestEntry {
  path: string
  status: ArtifactStatus
  hash?: string
  previousHash?: string
  bytes?: number
}

export interface GenerationManifest {
  outputRoot: string
  entries: GenerationManifestEntry[]
  summary: Record<ArtifactStatus, number>
  outdated: boolean
}

export interface GenerationResult {
  artifacts: GeneratedArtifact[]
  diagnostics: Diagnostic[]
  manifest: GenerationManifest
  written: boolean
}

export interface MaterializeArtifactOptions {
  /** Maximum serialized size for one artifact. Defaults to 64 MiB. */
  maxArtifactBytes?: number
  signal?: AbortSignal
}
