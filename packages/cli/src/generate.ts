import { build, createLogger, LogMapper, summarizeDiagnostics } from '@openapi-to/core'
import type { BuildResult, CLIOptions, OpenapiToSingleConfig } from '@openapi-to/core'

export interface GenerateServerResult {
  name?: string
  source: string
  output: string
  success: boolean
  result: BuildResult
}

export async function generate(openapiToSingleConfig: OpenapiToSingleConfig, CLIOptions: CLIOptions = {}): Promise<GenerateServerResult> {
  const logger = CLIOptions.json ? undefined : createLogger({ logLevel: CLIOptions.logLevel ?? LogMapper.info, name: openapiToSingleConfig.name })
  if (!CLIOptions.json) logger?.emit('start', `Building ${openapiToSingleConfig.input.path}`)
  const result = await build(openapiToSingleConfig, CLIOptions, logger)
  if (!CLIOptions.json) {
    const summary = summarizeDiagnostics(result.diagnostics)
    const manifest = result.generationResult?.manifest.summary
    if (result.error) logger?.consola?.error(`Build failed (${summary.errors} errors, ${summary.warnings} warnings)`)
    else logger?.consola?.success(`Build completed (${manifest?.added ?? 0} added, ${manifest?.modified ?? 0} modified, ${manifest?.deleted ?? 0} deleted, ${manifest?.unchanged ?? 0} unchanged)`)
  }
  return {
    name: openapiToSingleConfig.name,
    source: openapiToSingleConfig.input.path,
    output: openapiToSingleConfig.output.dir,
    success: !result.error,
    result,
  }
}
