import type { McpLogger } from '../logger.ts'
import type { ResolvedMcpServerOptions } from '../options.ts'
import type { GenerationLock } from '../generation/generation-lock.ts'
import type { TrustedConfigProvider } from '../generation/trusted-config.ts'

export interface ToolContext {
  options: ResolvedMcpServerOptions
  logger: McpLogger
  trustedConfig: TrustedConfigProvider
  generationLock: GenerationLock
}

export async function loggedToolCall<T>(context: ToolContext, tool: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try {
    const result = await operation()
    const payload = (result as { structuredContent?: Record<string, unknown> }).structuredContent
    const summary = payload?.diagnosticSummary as { errors?: number; warnings?: number; infos?: number } | undefined
    const truncated = payload?.truncated as Record<string, unknown> | undefined
    const success = payload?.success !== false
    const data = {
      tool,
      success,
      elapsedMs: Math.round(performance.now() - started),
      diagnosticCount: (summary?.errors ?? 0) + (summary?.warnings ?? 0) + (summary?.infos ?? 0),
      artifactCount: truncated?.totalArtifacts,
      changeCount: truncated?.totalChanges,
      truncated: truncated ? Object.entries(truncated).some(([key, value]) => !key.startsWith('total') && !key.startsWith('returned') && !key.startsWith('omitted') && value === true) : false,
    }
    if (success) context.logger.info('tool completed', data)
    else context.logger.warn('tool completed with execution error', data)
    return result
  } catch (error) {
    context.logger.warn('tool failed', { tool, success: false, elapsedMs: Math.round(performance.now() - started), error: error instanceof Error ? error.name : 'unknown' })
    throw error
  }
}
