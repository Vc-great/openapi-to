import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { checkGenerationInputSchema, checkGenerationOutputSchema, checkGenerationTool } from './check-generation.ts'
import type { ToolContext } from './context.ts'
import { diffInputSchema, diffOutputSchema, diffTool } from './diff.ts'
import { generateDryRunInputSchema, generateDryRunOutputSchema, generateDryRunTool } from './generate-dry-run.ts'
import { inspectInputSchema, inspectOutputSchema, inspectTool } from './inspect.ts'
import { validateInputSchema, validateOutputSchema, validateTool } from './validate.ts'

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const

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
    'openapi_generate_dry_run',
    {
      title: 'Preview OpenAPI Generation',
      description: 'Use to preview which configured generation artifacts would be added, modified, deleted, or unchanged. Unlike generation check, this returns the bounded plan and optional bounded text previews. It never writes files, manifests, snapshots, or caches and uses only startup-trusted config.',
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

export * from './validate.ts'
export * from './inspect.ts'
export * from './diff.ts'
export * from './generate-dry-run.ts'
export * from './check-generation.ts'
