import { hasDiagnosticErrors, sortDiagnostics, type Diagnostic } from '../diagnostics.ts'
import type { CompatibleOpenAPIDocument } from '../types'
import { resolveOpenAPIReferences, type ResolvedReferences } from './refResolver.ts'
import { loadOpenAPIDocument, type OpenAPIInput, type SourceLoaderOptions } from './sourceLoader.ts'
import { validateOpenAPIDocument } from './validator.ts'
import { normalizeOpenAPIDocument } from './normalizer.ts'

export interface OpenAPICompilation {
  success: boolean
  source: string
  uri: string
  version?: string
  document?: CompatibleOpenAPIDocument
  resolvedDocument?: CompatibleOpenAPIDocument
  normalizedDocument?: CompatibleOpenAPIDocument
  diagnostics: Diagnostic[]
  references?: Omit<ResolvedReferences, 'document' | 'resolvedDocument' | 'diagnostics'>
}

export async function compileOpenAPI(input: OpenAPIInput, options: SourceLoaderOptions = {}): Promise<OpenAPICompilation> {
  const loaded = await loadOpenAPIDocument(input, options)
  const diagnostics = [...loaded.diagnostics]
  if (!loaded.document) return { success: false, source: loaded.source, uri: loaded.uri, version: loaded.version, diagnostics: sortDiagnostics(diagnostics) }
  const references = await resolveOpenAPIReferences(loaded.document, loaded.uri, options)
  diagnostics.push(...references.diagnostics, ...validateOpenAPIDocument(loaded.document, loaded.source))
  const sorted = sortDiagnostics(diagnostics)
  return {
    success: !hasDiagnosticErrors(sorted),
    source: loaded.source,
    uri: loaded.uri,
    version: loaded.version,
    document: loaded.document,
    resolvedDocument: references.resolvedDocument,
    normalizedDocument: normalizeOpenAPIDocument(references.resolvedDocument),
    diagnostics: sorted,
    references: {
      externalReferenceCount: references.externalReferenceCount,
      loadedSources: references.loadedSources,
    },
  }
}
