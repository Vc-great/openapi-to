import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ExitCode } from '@openapi-to/core'
import { run, type CLIIO } from './index.ts'

describe.sequential('CLI machine-readable commands', () => {
  let cwd: string
  let root: string
  let spec: string
  let stdout: string[]
  let stderr: string[]
  let io: CLIIO

  beforeEach(async () => {
    cwd = process.cwd()
    root = await mkdtemp(path.join(os.tmpdir(), 'openapi-cli-'))
    spec = path.join(root, 'openapi.yaml')
    await writeFile(spec, `openapi: 3.1.0\ninfo:\n  title: CLI fixture\n  version: 1.0.0\npaths:\n  /pets:\n    get:\n      operationId: listPets\n      responses:\n        '200':\n          description: ok\n`)
    await mkdir(path.join(root, '.OpenAPI'))
    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.js'),
      `module.exports = {
        servers: [{ name: 'fixture', input: { path: './openapi.yaml' }, output: { dir: 'generated', clean: true } }],
        plugins: [{ name: 'fixture-plugin', hooks: { buildStart(ctx) { console.log('plugin progress'); ctx.addArtifact({ kind: 'text', path: ctx.openapiToSingleConfig.output.dir + '/hello.txt', content: 'hello\\n', plugin: 'fixture-plugin' }) } } }]
      }`,
    )
    process.chdir(root)
    stdout = []
    stderr = []
    io = { stdout: (message) => stdout.push(message), stderr: (message) => stderr.push(message) }
  })

  afterEach(() => {
    process.chdir(cwd)
    process.exitCode = 0
  })

  it('validates JSON/YAML, refs, cycles, 3.2 warnings, and global JSON placement', async () => {
    const validate = await run(['node', 'openapi', 'validate', spec, '--json'], io)
    const validateJSON = JSON.parse(stdout.join('\n'))
    expect(validate.exitCode).toBe(ExitCode.Success)
    expect(validateJSON).toMatchObject({ success: true, command: 'validate' })
    const jsonSpec = path.join(root, 'openapi.json')
    await writeFile(jsonSpec, JSON.stringify({ openapi: '3.1.0', info: { title: 'JSON', version: '1' }, paths: {} }))
    stdout = []
    expect((await run(['node', 'openapi', '--json', 'validate', jsonSpec], io)).exitCode).toBe(ExitCode.Success)
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({ success: true, command: 'validate' })

    const missingRef = path.join(root, 'missing-ref.yaml')
    await writeFile(missingRef, 'openapi: 3.1.0\ninfo: { title: Missing, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Missing: { $ref: "#/components/schemas/Nope" }\n')
    stdout = []
    expect((await run(['node', 'openapi', 'validate', missingRef, '--json'], io)).exitCode).toBe(ExitCode.OpenAPIError)
    expect(JSON.parse(stdout.join('\n')).diagnostics.filter((diagnostic: { code: string }) => diagnostic.code === 'OPENAPI_REF_NOT_FOUND')).toHaveLength(1)

    const cycle = path.join(root, 'cycle.yaml')
    await writeFile(cycle, 'openapi: 3.1.0\ninfo: { title: Cycle, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Node: { type: object, properties: { next: { $ref: "#/components/schemas/Node" } } }\n')
    stdout = []
    expect((await run(['node', 'openapi', 'validate', cycle, '--json'], io)).exitCode).toBe(ExitCode.Success)
    expect(JSON.parse(stdout.join('\n')).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OPENAPI_REF_CYCLE' })]))

    const openapi32 = path.resolve(cwd, 'packages/core/src/openapi/fixtures/openapi-3.2.yaml')
    stdout = []
    expect((await run(['node', 'openapi', 'validate', openapi32, '--json', '--fail-on-warning'], io)).exitCode).toBe(ExitCode.OpenAPIError)
    expect(JSON.parse(stdout.join('\n')).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OPENAPI_WARNINGS_AS_ERRORS' })]))
  })

  it('inspects Swagger 2.0 and OpenAPI 3.0/3.1/3.2 with security and external refs', async () => {
    const inputs = [
      path.resolve(cwd, 'packages/core/mock/swagger2.0.json'),
      path.resolve(cwd, 'packages/core/mock/openapiV3.json'),
      spec,
      path.resolve(cwd, 'packages/core/src/openapi/fixtures/openapi-3.2.yaml'),
    ]
    for (const input of inputs) {
      stdout = []
      const result = await run(['node', 'openapi', 'inspect', input, '--json'], io)
      expect(result.exitCode).toBe(ExitCode.Success)
      expect(JSON.parse(stdout.join('\n')).inspection.openapiVersion).toMatch(/^(2\.0|3\.)/)
    }

    const inspectSpec = path.join(root, 'inspect.yaml')
    await writeFile(inspectSpec, 'openapi: 3.1.0\ninfo: { title: Inspect, version: "1" }\npaths:\n  /missing:\n    get:\n      responses: { "200": { description: ok } }\ncomponents:\n  securitySchemes:\n    bearer: { type: http, scheme: bearer }\n  schemas:\n    Pet: { $ref: "./schema.yaml#/$defs/Pet" }\n')
    await writeFile(path.join(root, 'schema.yaml'), '$defs:\n  Pet: { type: object }\n')
    stdout = []
    await run(['node', 'openapi', 'inspect', inspectSpec, '--json'], io)
    const inspection = JSON.parse(stdout.join('\n')).inspection
    expect(inspection).toMatchObject({ externalReferenceCount: 1, securitySchemes: ['bearer'] })
    expect(inspection.missingOperationIds).toHaveLength(1)
  })

  it('diff emits stable JSON and code 7 with --fail-on-breaking', async () => {
    const next = path.join(root, 'next.yaml')
    await writeFile(next, `openapi: 3.1.0\ninfo:\n  title: CLI fixture\n  version: 2.0.0\npaths: {}\n`)
    const result = await run(['node', 'openapi', 'diff', spec, next, '--json', '--fail-on-breaking'], io)
    const json = JSON.parse(stdout.join('\n'))
    expect(result.exitCode).toBe(ExitCode.BreakingChanges)
    expect(json.breaking).toBe(true)
    expect(json.changes.some((change: { code: string }) => change.code === 'PATH_REMOVED')).toBe(true)

    stdout = []
    expect((await run(['node', 'openapi', 'diff', spec, spec, '--json'], io)).exitCode).toBe(ExitCode.Success)
    expect(JSON.parse(stdout.join('\n')).changes).toEqual([])

    const added = path.join(root, 'added.yaml')
    await writeFile(added, `${await readFile(spec, 'utf8')}\n  /owners:\n    get:\n      responses: { '200': { description: ok } }\n`)
    stdout = []
    await run(['node', 'openapi', 'diff', spec, added, '--json'], io)
    expect(JSON.parse(stdout.join('\n')).changes).toEqual(expect.arrayContaining([expect.objectContaining({ classification: 'non-breaking', code: 'PATH_ADDED' })]))

    const warningBefore = path.join(root, 'warning-before.yaml')
    const warningAfter = path.join(root, 'warning-after.yaml')
    await writeFile(warningBefore, 'openapi: 3.1.0\ninfo: { title: W, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Value: { type: string, minLength: 1 }\n')
    await writeFile(warningAfter, 'openapi: 3.1.0\ninfo: { title: W, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Value: { type: string, minLength: 2 }\n')
    stdout = []
    await run(['node', 'openapi', 'diff', warningBefore, warningAfter, '--json'], io)
    expect(JSON.parse(stdout.join('\n')).changes).toEqual(expect.arrayContaining([expect.objectContaining({ classification: 'warning', code: 'SCHEMA_CONSTRAINT_CHANGED' })]))

    const invalidBreaking = path.join(root, 'invalid-breaking.yaml')
    await writeFile(invalidBreaking, 'openapi: 3.1.0\ninfo: { version: "1" }\npaths:\n  /pets:\n    get:\n      responses: { "200": { description: ok } }\n')
    stdout = []
    expect((await run(['node', 'openapi', 'diff', invalidBreaking, next, '--json', '--fail-on-breaking'], io)).exitCode).toBe(ExitCode.OpenAPIError)
  })

  it('dry-run and check never write, while write and a following check agree', async () => {
    const outputFile = path.join(root, '.OpenAPI/generated/hello.txt')
    const ownershipManifest = path.join(root, '.OpenAPI/generated/.openapi-to-manifest.json')
    let result = await run(['node', 'openapi', 'generate', '--dry-run', '--json'], io)
    let json = JSON.parse(stdout.join('\n'))
    expect(result.exitCode).toBe(ExitCode.Success)
    expect(json.servers[0].manifest.summary.added).toBe(1)
    await expect(access(outputFile)).rejects.toThrow()
    await expect(access(ownershipManifest)).rejects.toThrow()

    stdout = []
    result = await run(['node', 'openapi', 'generate', '--check', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.GeneratedOutputOutdated)
    await expect(access(outputFile)).rejects.toThrow()
    await expect(access(ownershipManifest)).rejects.toThrow()

    stdout = []
    result = await run(['node', 'openapi', 'generate', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.Success)
    expect(await readFile(outputFile, 'utf8')).toBe('hello\n')
    expect(stderr).toContain('plugin progress')

    const userFile = path.join(root, '.OpenAPI/generated/user.txt')
    await writeFile(userFile, 'owned by user')
    await writeFile(outputFile, 'outdated')
    stdout = []
    result = await run(['node', 'openapi', 'generate', '--check', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.GeneratedOutputOutdated)
    expect(await readFile(outputFile, 'utf8')).toBe('outdated')
    expect(await readFile(userFile, 'utf8')).toBe('owned by user')

    stdout = []
    await run(['node', 'openapi', 'generate', '--json'], io)
    expect(await readFile(userFile, 'utf8')).toBe('owned by user')

    await rm(outputFile)
    stdout = []
    result = await run(['node', 'openapi', 'generate', '--check', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.GeneratedOutputOutdated)
    await expect(access(outputFile)).rejects.toThrow()

    stdout = []
    result = await run(['node', 'openapi', 'generate', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.Success)
    stdout = []
    result = await run(['node', 'openapi', 'generate', '--check', '--json'], io)
    json = JSON.parse(stdout.join('\n'))
    expect(result.exitCode).toBe(ExitCode.Success)
    expect(json.servers[0].manifest.summary.unchanged).toBe(1)

    const firstCheck = stdout.join('\n')
    stdout = []
    result = await run(['node', 'openapi', 'generate', '--check', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.Success)
    expect(stdout.join('\n')).toBe(firstCheck)
  })

  it('maps input, validation, and plugin failures to stable exit codes', async () => {
    let result = await run(['node', 'openapi', 'validate', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.GeneralError)
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({ success: false, diagnostics: [{ code: 'CLI_EXECUTION_FAILED' }] })

    stdout = []
    result = await run(['node', 'openapi', 'validate', path.join(root, 'missing.yaml'), '--json'], io)
    expect(result.exitCode).toBe(ExitCode.InputError)

    const invalid = path.join(root, 'invalid.yaml')
    await writeFile(invalid, 'openapi: [')
    stdout = []
    result = await run(['node', 'openapi', 'validate', invalid, '--json'], io)
    expect(result.exitCode).toBe(ExitCode.OpenAPIError)

    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.js'),
      `module.exports = {
        servers: [{ input: { path: './openapi.yaml' }, output: { dir: 'generated' } }],
        plugins: [{ name: 'broken', hooks: { buildStart() { throw new Error('broken plugin') } } }]
      }`,
    )
    stdout = []
    result = await run(['node', 'openapi', 'generate', '--json'], io)
    expect(result.exitCode).toBe(ExitCode.PluginError)
    expect(JSON.parse(stdout.join('\n')).diagnostics[0].code).toBe('PLUGIN_EXECUTION_FAILED')
  })
})
