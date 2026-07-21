import {
  applyGenerationInputSchema,
  applyGenerationOutputSchema,
  checkGenerationInputSchema,
  checkGenerationOutputSchema,
  diffInputSchema,
  diffOutputSchema,
  generateDryRunInputSchema,
  generateDryRunOutputSchema,
  inspectInputSchema,
  inspectOutputSchema,
  prepareGenerationInputSchema,
  prepareGenerationOutputSchema,
  validateInputSchema,
  validateOutputSchema,
} from './index.ts'

const diagnostics = {
  diagnostics: [],
  diagnosticSummary: { errors: 0, warnings: 0, infos: 0 },
  truncated: { diagnostics: false, totalDiagnostics: 0, returnedDiagnostics: 0, omittedDiagnostics: 0 },
}

const cases = [
  {
    name: 'validate',
    input: validateInputSchema,
    validInput: { source: 'openapi.yaml' },
    invalidInput: { source: '' },
    output: validateOutputSchema,
    validOutput: { schemaVersion: 1, tool: 'openapi_validate', success: false, ...diagnostics },
  },
  {
    name: 'inspect',
    input: inspectInputSchema,
    validInput: { source: 'openapi.yaml', includeOperations: true },
    invalidInput: { source: 42 },
    output: inspectOutputSchema,
    validOutput: { schemaVersion: 1, tool: 'openapi_inspect', success: false, ...diagnostics },
  },
  {
    name: 'diff',
    input: diffInputSchema,
    validInput: { before: 'before.yaml', after: 'after.yaml' },
    invalidInput: { before: 'before.yaml' },
    output: diffOutputSchema,
    validOutput: { schemaVersion: 1, tool: 'openapi_diff', success: false, ...diagnostics },
  },
  {
    name: 'dry-run',
    input: generateDryRunInputSchema,
    validInput: { targets: ['sdk'], includePreview: false },
    invalidInput: { targets: [''] },
    output: generateDryRunOutputSchema,
    validOutput: { schemaVersion: 1, tool: 'openapi_generate_dry_run', success: false, ...diagnostics },
  },
  {
    name: 'check',
    input: checkGenerationInputSchema,
    validInput: { targets: ['sdk'] },
    invalidInput: { targets: Array.from({ length: 101 }, () => 'sdk') },
    output: checkGenerationOutputSchema,
    validOutput: { schemaVersion: 1, tool: 'openapi_check_generation', success: false, ...diagnostics },
  },
  {
    name: 'prepare',
    input: prepareGenerationInputSchema,
    validInput: { targets: ['sdk'] },
    invalidInput: { targets: ['sdk'], configPath: 'untrusted.cjs' },
    output: prepareGenerationOutputSchema,
    validOutput: { schemaVersion: 1, tool: 'openapi_prepare_generation', success: false, ...diagnostics },
  },
  {
    name: 'apply',
    input: applyGenerationInputSchema,
    validInput: {
      planId: '123e4567-e89b-42d3-a456-426614174000',
      token: 'a'.repeat(32),
      approvedPlanHash: 'b'.repeat(64),
    },
    invalidInput: {
      planId: 'not-a-plan-id',
      token: 'short',
      approvedPlanHash: 'not-a-hash',
    },
    output: applyGenerationOutputSchema,
    validOutput: {
      schemaVersion: 1,
      tool: 'openapi_apply_generation',
      success: false,
      applied: false,
      rollbackPerformed: false,
      ...diagnostics,
    },
  },
] as const

describe('MCP Tool schemas', () => {
  it.each(cases)('$name accepts its bounded contract and rejects malformed values', ({ input, validInput, invalidInput, output, validOutput }) => {
    expect(input.safeParse(validInput).success).toBe(true)
    expect(input.safeParse(invalidInput).success).toBe(false)
    expect(output.safeParse(validOutput).success).toBe(true)
    expect(output.safeParse({ ...validOutput, tool: 'wrong_tool' }).success).toBe(false)
  })
})
