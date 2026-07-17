import converter from 'do-swagger2openapi'

import { compareArtifacts, formatMaterializedArtifacts, materializeArtifacts, sortGeneratedArtifacts, sourceFileToArtifact, writeArtifacts, type GenerationManifest, type GenerationResult } from './artifacts/index.ts'
import { DiagnosticError, hasDiagnosticErrors, sortDiagnostics, type Diagnostic } from './diagnostics.ts'
import { compileOpenAPI, loadOpenAPIDocument } from './openapi/index.ts'
import { PluginManager } from './pluginManager'

import type { Logger } from './logger.ts'
import type { CLIOptions, CompatibleOpenAPIDocument, OpenAPIAllDocument, OpenAPIDocument, OpenapiToSingleConfig } from './types'

export async function requestRemoteData(requestUrl: string): Promise<OpenAPIAllDocument | undefined> {
  const loaded = await loadOpenAPIDocument(requestUrl)
  return loaded.originalDocument ?? loaded.document
}

export async function swagger2ToOpenapi3(openapiDocument: OpenAPIAllDocument): Promise<CompatibleOpenAPIDocument | undefined> {
  if ('openapi' in openapiDocument) return openapiDocument
  const converted = await converter.convertObj(openapiDocument, { warnOnly: true })
  return converted.openapi as CompatibleOpenAPIDocument
}

export interface BuildResult {
  pluginManager: PluginManager
  generationResult?: GenerationResult
  diagnostics: Diagnostic[]
  error?: Error
}

function emptyManifest(outputRoot: string): GenerationResult['manifest'] {
  return {
    outputRoot,
    entries: [],
    summary: { added: 0, modified: 0, deleted: 0, unchanged: 0 },
    outdated: false,
  }
}

export async function build(
  openapiToSingleConfig: OpenapiToSingleConfig,
  CLIOptions: CLIOptions = {},
  _logger?: Logger,
): Promise<BuildResult> {
  const compilation = await compileOpenAPI(openapiToSingleConfig.input.path, {
    cwd: openapiToSingleConfig.root,
    remote: openapiToSingleConfig.input.remote,
    debug: CLIOptions.debug,
  })
  const placeholderDocument = (compilation.document ?? { openapi: '3.1.0', info: { title: 'invalid', version: '0' }, paths: {} }) as OpenAPIDocument
  const pluginManager = new PluginManager(openapiToSingleConfig, placeholderDocument)
  let diagnostics = [...compilation.diagnostics]
  if (!compilation.document || hasDiagnosticErrors(diagnostics)) {
    const error = new DiagnosticError('OpenAPI compilation failed.', diagnostics)
    return { pluginManager, diagnostics: sortDiagnostics(diagnostics), error }
  }

  let execution: Awaited<ReturnType<PluginManager['execute']>>
  try {
    execution = await pluginManager.execute()
  } catch (error) {
    diagnostics.push({ code: 'PLUGIN_EXECUTION_FAILED', severity: 'error', message: 'Plugin execution failed.', cause: error instanceof Error ? error.message : undefined })
    const diagnosticError = new DiagnosticError('Plugin execution failed.', diagnostics)
    return { pluginManager, diagnostics: sortDiagnostics(diagnostics), error: diagnosticError }
  }
  diagnostics.push(...execution.diagnostics)
  const artifacts = sortGeneratedArtifacts([...execution.sourceFiles.map((sourceFile) => sourceFileToArtifact(sourceFile)), ...execution.artifacts])
  const materialized = materializeArtifacts(artifacts, openapiToSingleConfig.output.dir)
  diagnostics.push(...materialized.diagnostics)
  if (hasDiagnosticErrors(diagnostics)) {
    const error = new DiagnosticError('Generation failed.', diagnostics)
    return {
      pluginManager,
      diagnostics: sortDiagnostics(diagnostics),
      generationResult: { artifacts, diagnostics: sortDiagnostics(diagnostics), manifest: emptyManifest(openapiToSingleConfig.output.dir), written: false },
      error,
    }
  }

  const formatted = await formatMaterializedArtifacts(materialized.artifacts, openapiToSingleConfig.output.format)
  diagnostics.push(...formatted.diagnostics)
  let manifest: GenerationManifest
  try {
    manifest = await compareArtifacts(formatted.artifacts, openapiToSingleConfig.output.dir, openapiToSingleConfig.output.clean === true)
  } catch (error) {
    diagnostics.push({ code: 'OUTPUT_COMPARE_FAILED', severity: 'error', message: 'Unable to compare generated artifacts with existing output.', location: { source: openapiToSingleConfig.output.dir }, cause: error instanceof Error ? error.message : undefined })
    const diagnosticError = new DiagnosticError('Output comparison failed.', diagnostics)
    return { pluginManager, diagnostics: sortDiagnostics(diagnostics), error: diagnosticError }
  }

  let written = false
  if (CLIOptions.check && manifest.outdated) {
    diagnostics.push({ code: 'GENERATED_OUTPUT_OUTDATED', severity: 'error', message: 'Generated output is not up to date.', location: { source: openapiToSingleConfig.output.dir }, hint: 'Run openapi generate to update generated files.' })
  } else if (!CLIOptions.dryRun && !CLIOptions.check) {
    try {
      await writeArtifacts(formatted.artifacts, manifest)
      written = true
    } catch (error) {
      diagnostics.push({ code: 'OUTPUT_WRITE_FAILED', severity: 'error', message: 'Unable to write generated artifacts.', location: { source: openapiToSingleConfig.output.dir }, cause: error instanceof Error ? error.message : undefined })
    }
  }
  pluginManager.filesCreated = materialized.artifacts.length
  diagnostics = sortDiagnostics(diagnostics)
  const generationResult: GenerationResult = { artifacts, diagnostics, manifest, written }
  const error = hasDiagnosticErrors(diagnostics) ? new DiagnosticError('Generation failed.', diagnostics) : undefined
  return { pluginManager, generationResult, diagnostics, error }
}
