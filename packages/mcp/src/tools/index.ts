import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { checkGenerationInputSchema, checkGenerationOutputSchema, checkGenerationTool } from './check-generation.ts'
import { applyGenerationInputSchema, applyGenerationOutputSchema, applyGenerationTool } from './apply-generation.ts'
import type { ToolContext } from './context.ts'
import { diffInputSchema, diffOutputSchema, diffTool } from './diff.ts'
import { generateDryRunInputSchema, generateDryRunOutputSchema, generateDryRunTool } from './generate-dry-run.ts'
import { inspectInputSchema, inspectOutputSchema, inspectTool } from './inspect.ts'
import { prepareGenerationInputSchema, prepareGenerationOutputSchema, prepareGenerationTool } from './prepare-generation.ts'
import { validateInputSchema, validateOutputSchema, validateTool } from './validate.ts'
import { getOperationInputSchema, getOperationOutputSchema, getOperationTool } from './get-operation.ts'
import { listTargetsInputSchema, listTargetsOutputSchema, listTargetsTool } from './list-targets.ts'
import { searchOperationsInputSchema, searchOperationsOutputSchema, searchOperationsTool } from './search-operations.ts'

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const

const TRUSTED_CONFIG_READ_ONLY_ANNOTATIONS = { ...READ_ONLY_ANNOTATIONS, openWorldHint: false } as const

export function registerReadOnlyTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    'openapi_validate',
    {
      title: 'Validate OpenAPI',
      description: 'Use when the question is whether one OpenAPI document is valid or why parsing, references, or validation failed. Does not summarize API shape, compare versions, generate code, or modify files. Parser acceptance does not imply every generator supports every construct; OpenAPI 3.2 is compatible-read with diagnosed generation gaps.',
      inputSchema: validateInputSchema,
      outputSchema: validateOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => validateTool(context, input, extra),
  )
  server.registerTool(
    'openapi_inspect',
    {
      title: 'Inspect OpenAPI',
      description: 'Use for counts, operations, tags, missing operationIds, security schemes, and compatibility classification of one OpenAPI document. This is structural inspection, not validation or version comparison. Returns a bounded summary, never the full document, and modifies no files.',
      inputSchema: inspectInputSchema,
      outputSchema: inspectOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => inspectTool(context, input, extra),
  )
  server.registerTool(
    'openapi_diff',
    {
      title: 'Compare OpenAPI Documents',
      description: 'Use only to compare a before and after OpenAPI document for first-stage breaking, non-breaking, and warning changes. This is not validation, generation freshness, a complete compatibility proof, or a breaking-change oracle. Modifies no files.',
      inputSchema: diffInputSchema,
      outputSchema: diffOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => diffTool(context, input, extra),
  )
  if (!context.trustedConfig.configured) return
  server.registerTool(
    'openapi_list_targets',
    {
      title: 'List Trusted OpenAPI Targets',
      description: 'Use before operation search when the startup-trusted configuration has multiple targets. Returns only target names, local/remote source type, bounded counts, generation availability, and diagnostic summaries. Never returns source locations, URLs, headers, secrets, configuration bodies, or OpenAPI documents.',
      inputSchema: listTargetsInputSchema,
      outputSchema: listTargetsOutputSchema,
      annotations: TRUSTED_CONFIG_READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => listTargetsTool(context, input, extra),
  )
  server.registerTool(
    'openapi_search_operations',
    {
      title: 'Search Trusted OpenAPI Operations',
      description: 'Use to find a small ranked set of operations in one startup-trusted target by operation identity, method/path, tags, parameters, schema names, summary, or description. Returns lightweight summaries only; never returns a full OpenAPI document, full operation object, or schema body, and never generates or writes files.',
      inputSchema: searchOperationsInputSchema,
      outputSchema: searchOperationsOutputSchema,
      annotations: TRUSTED_CONFIG_READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => searchOperationsTool(context, input, extra),
  )
  server.registerTool(
    'openapi_get_operation',
    {
      title: 'Read Trusted OpenAPI Operation Contract',
      description: 'Use after openapi_search_operations to read one selected operation by stable operationKey. Returns summary or a bounded request/response contract with depth-, count-, property-, example-, and byte-limited related schema summaries. Never returns the full OpenAPI document or components.schemas and never generates or writes files.',
      inputSchema: getOperationInputSchema,
      outputSchema: getOperationOutputSchema,
      annotations: TRUSTED_CONFIG_READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => getOperationTool(context, input, extra),
  )
  server.registerTool(
    'openapi_generate_dry_run',
    {
      title: 'Preview OpenAPI Generation',
      description: 'Use to preview which configured generation artifacts would be added, modified, deleted, or unchanged. Omit scope (or use full) for the existing full preview; after operation search and contract review, use an operations scope with exact operationKeys to preview artifacts from an in-memory projected compilation for exactly one trusted target. Returns bounded summaries and optional bounded text previews; it never writes files, manifests, plans, snapshots, or caches.',
      inputSchema: generateDryRunInputSchema,
      outputSchema: generateDryRunOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => generateDryRunTool(context, input, extra),
  )
  server.registerTool(
    'openapi_check_generation',
    {
      title: 'Check OpenAPI Generation',
      description: 'Use for CI/freshness questions: whether current configured generated files are outdated. Unlike dry-run, this focuses on current versus expected hashes and never repairs, writes, or deletes anything. Uses only startup-trusted config.',
      inputSchema: checkGenerationInputSchema,
      outputSchema: checkGenerationOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input, extra) => checkGenerationTool(context, input, extra),
  )
}

export function registerControlledWriteTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    'openapi_prepare_generation',
    {
      title: 'Prepare Controlled OpenAPI Generation',
      description: 'Use first when the user wants generated SDK files updated or wants a reviewable write plan. Without selection it preserves the existing full plan/token flow. With selection { type: add, operationKeys } it unions exact keys with trusted persisted project selection, generates the complete desired projection, and returns a review-only plan with applySupported false and no token. Prepare never writes selection, generated files, locks, staging, or ownership manifests. Exactly one trusted target/output root is supported; callers cannot choose paths, config, plugins, cleanup, or content.',
      inputSchema: prepareGenerationInputSchema,
      outputSchema: prepareGenerationOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (input, extra) => prepareGenerationTool(context, input, extra),
  )
  server.registerTool(
    'openapi_apply_generation',
    {
      title: 'Apply Confirmed OpenAPI Generation Plan',
      description: 'Use only after the user explicitly confirms one unexpired full openapi_prepare_generation result with applySupported true and its exact plan hash/token. Review-only selective plans are rejected before generation or filesystem locks. A supported full plan is revalidated and committed through the existing locked transaction; callers cannot pass targets, paths, content, force, or safety overrides.',
      inputSchema: applyGenerationInputSchema,
      outputSchema: applyGenerationOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    (input, extra) => applyGenerationTool(context, input, extra),
  )
}

export * from './validate.ts'
export * from './inspect.ts'
export * from './diff.ts'
export * from './generate-dry-run.ts'
export * from './check-generation.ts'
export * from './prepare-generation.ts'
export * from './apply-generation.ts'
export * from './list-targets.ts'
export * from './search-operations.ts'
export * from './get-operation.ts'
