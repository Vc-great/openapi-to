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
      description: 'Load, parse, resolve references, and validate an OpenAPI document. Does not generate code or modify files. Parser acceptance does not imply every generator supports every construct; OpenAPI 3.2 is currently compatible-read with diagnosed generation gaps.',
      inputSchema: validateInputSchema,
      outputSchema: validateOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input) => validateTool(context, input),
  )
  server.registerTool(
    'openapi_inspect',
    {
      title: 'Inspect OpenAPI',
      description: 'Return a bounded, structured summary of an OpenAPI document and its compatibility classification. Does not return the full document or modify files.',
      inputSchema: inspectInputSchema,
      outputSchema: inspectOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input) => inspectTool(context, input),
  )
  server.registerTool(
    'openapi_diff',
    {
      title: 'Compare OpenAPI Documents',
      description: 'Compare two OpenAPI documents with the first-stage breaking/non-breaking/warning rules. This is not a complete compatibility proof or breaking-change oracle. Does not modify files.',
      inputSchema: diffInputSchema,
      outputSchema: diffOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input) => diffTool(context, input),
  )
  if (!context.trustedConfig.configured) return
  server.registerTool(
    'openapi_generate_dry_run',
    {
      title: 'Preview OpenAPI Generation',
      description: 'Run configured plugins and compute bounded artifact changes without writing generated files, ownership manifests, snapshots, or caches. Uses only the trusted configuration fixed at server startup.',
      inputSchema: generateDryRunInputSchema,
      outputSchema: generateDryRunOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input) => generateDryRunTool(context, input),
  )
  server.registerTool(
    'openapi_check_generation',
    {
      title: 'Check OpenAPI Generation',
      description: 'Check whether configured generated files match the current OpenAPI inputs without repairing, writing, or deleting anything. Uses only the trusted configuration fixed at server startup.',
      inputSchema: checkGenerationInputSchema,
      outputSchema: checkGenerationOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (input) => checkGenerationTool(context, input),
  )
}

export * from './validate.ts'
export * from './inspect.ts'
export * from './diff.ts'
export * from './generate-dry-run.ts'
export * from './check-generation.ts'
