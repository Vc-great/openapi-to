import { z } from 'zod'

import { OutputTransactionRolledBackError, OutputTransactionRollbackError } from '@openapi-to/core'

import { safeExecutionDiagnostic } from '../errors.ts'
import { applyGenerationWritePlan, assertGenerationPlanApplySupported } from '../generation/write-plan.ts'
import { createToolResult, diagnosticSchema, diagnosticSummarySchema, executionFailure, truncateDiagnostics } from '../result.ts'
import { detachedHandlerExtra, loggedToolCall, type McpHandlerExtra, type ToolContext } from './context.ts'

export const applyGenerationInputSchema = z.object({
  planId: z.string().uuid(),
  token: z.string().min(32).max(256),
  approvedPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

const appliedFileSchema = z.object({ path: z.string(), status: z.enum(['added', 'modified']).optional() })

export const applyGenerationOutputSchema = z.object({
  schemaVersion: z.literal(1),
  tool: z.literal('openapi_apply_generation'),
  success: z.boolean(),
  applied: z.boolean(),
  planId: z.string().optional(),
  planHash: z.string().optional(),
  transactionId: z.string().optional(),
  summary: z.object({ added: z.number().int(), modified: z.number().int(), deleted: z.number().int(), unchanged: z.number().int() }).optional(),
  changedFiles: z.array(appliedFileSchema).optional(),
  deletedFiles: z.array(z.string()).optional(),
  rollbackPerformed: z.boolean(),
  diagnostics: z.array(diagnosticSchema),
  diagnosticSummary: diagnosticSummarySchema,
  truncated: z.object({
    diagnostics: z.boolean(), totalDiagnostics: z.number().int(), returnedDiagnostics: z.number().int(), omittedDiagnostics: z.number().int(),
    changes: z.boolean().optional(), totalChanges: z.number().int().optional(), returnedChanges: z.number().int().optional(), omittedChanges: z.number().int().optional(),
  }),
})

export async function applyGenerationTool(context: ToolContext, input: z.infer<typeof applyGenerationInputSchema>, extra: McpHandlerExtra = detachedHandlerExtra()) {
  const tool = 'openapi_apply_generation'
  return loggedToolCall(context, tool, extra, async (execution) => {
    try {
      if (!context.generationPlans) throw new Error('Controlled write plan storage is unavailable.')
      // Reject review-only selective plans before entering the per-Server
      // generation queue or acquiring the destination filesystem lock.
      assertGenerationPlanApplySupported(context.generationPlans as NonNullable<ToolContext['generationPlans']>, input)
      return await context.generationLock.run(async () => {
        await execution.progress('Validating prepared plan', 5)
        const applied = await applyGenerationWritePlan(
          context.trustedConfig,
          context.generationPlans as NonNullable<ToolContext['generationPlans']>,
          context.options,
          input,
          context.logger,
          execution,
        )
        const allChanges = [...applied.changedFiles, ...applied.deletedFiles.map((deletedPath) => ({ path: deletedPath as string }))]
        const returned = allChanges.slice(0, context.options.limits.maxChanges)
        const diagnostics = applied.cancelledDuringCommit
          ? [{ code: 'MCP_APPLY_CANCEL_DEFERRED', severity: 'warning' as const, message: 'Cancellation arrived during the commit critical section; the transaction completed safely before responding.' }]
          : []
        if (returned.length < allChanges.length) diagnostics.push({ code: 'MCP_RESULT_TRUNCATED', severity: 'warning', message: `The Apply result omitted ${allChanges.length - returned.length} changed paths.` })
        const bounded = truncateDiagnostics(context.options.workspaceRoot, diagnostics, context.options.limits.maxDiagnostics)
        await execution.progress('Apply complete', 100)
        return createToolResult(
          tool,
          {
            success: true,
            applied: true,
            planId: applied.plan.planId,
            planHash: applied.plan.planHash,
            transactionId: applied.transactionId,
            summary: applied.summary,
            changedFiles: returned.filter((item): item is { path: string; status: 'added' | 'modified' } => 'status' in item),
            deletedFiles: returned.filter((item) => !('status' in item)).map(({ path: deletedPath }) => deletedPath),
            rollbackPerformed: applied.rollbackPerformed,
            diagnostics: bounded.diagnostics,
            diagnosticSummary: bounded.summary,
            truncated: {
              ...bounded.truncated,
              changes: returned.length < allChanges.length,
              totalChanges: allChanges.length,
              returnedChanges: returned.length,
              omittedChanges: allChanges.length - returned.length,
            },
          },
          `applied the reviewed plan atomically: ${applied.summary.added} added, ${applied.summary.modified} modified, ${applied.summary.deleted} managed file(s) deleted`,
          context.options.limits,
        )
      }, execution.signal)
    } catch (error) {
      return executionFailure(context.options.workspaceRoot, tool, [safeExecutionDiagnostic(error, execution)], context.options.limits, {
        applied: false,
        rollbackPerformed: error instanceof OutputTransactionRolledBackError || error instanceof OutputTransactionRollbackError,
      })
    }
  })
}
