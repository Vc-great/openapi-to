import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.join(packageRoot, 'src/evaluation/fixtures')

const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const operation = (id, tag = 'default') => ({ operationId: id, tags: [tag], responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Entity' } } } } } })

async function put(relative, value) {
  const target = path.join(root, relative)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, typeof value === 'string' ? value : stable(value))
}

const small = [
  ['small/openapi-3.0.json', '3.0.3'],
  ['small/openapi-3.1.json', '3.1.0'],
  ['small/openapi-3.2.json', '3.2.0'],
]
for (const [file, version] of small) await put(file, { openapi: version, info: { title: file, version: '1' }, paths: { '/ping': { get: operation('ping') } }, components: { schemas: { Entity: { type: 'object', properties: { id: { type: 'string' } } } } } })
await put('small/swagger-2.0.json', { swagger: '2.0', info: { title: 'Swagger', version: '1' }, paths: { '/ping': { get: { operationId: 'ping', responses: { 200: { description: 'ok' } } } } } })

const mediumPaths = {}
for (let index = 0; index < 150; index += 1) mediumPaths[`/resources/${index}`] = { get: operation(`getResource${index}`, `tag${index % 12}`) }
const mediumSchemas = { Entity: { $ref: './schemas.json#/Entity' } }
for (let index = 0; index < 80; index += 1) mediumSchemas[`Schema${index}`] = { type: 'object', nullable: index % 2 === 0, properties: { value: { type: 'string' }, nested: { $ref: './schemas.json#/Nested' } } }
await put('medium/openapi.json', {
  openapi: '3.1.0', info: { title: 'Synthetic medium corpus', version: '1' }, paths: mediumPaths,
  tags: Array.from({ length: 12 }, (_, index) => ({ name: `tag${index}` })),
  components: { schemas: mediumSchemas, securitySchemes: { bearer: { type: 'http', scheme: 'bearer' }, apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
})
await put('medium/schemas.json', { Entity: { type: 'object', properties: { id: { type: 'string' } } }, Nested: { oneOf: [{ type: 'string' }, { type: 'null' }] } })

const largePaths = {}
for (let index = 0; index < 700; index += 1) largePaths[`/enterprise/resources/${index}`] = { get: operation(`getEnterpriseResource${index}`, `domain${index % 30}`) }
const largeSchemas = { Entity: { $ref: './schemas-a.json#/Entity' } }
for (let index = 0; index < 300; index += 1) largeSchemas[`EnterpriseSchema${index}`] = { $ref: `./schemas-${index % 2 ? 'a' : 'b'}.json#/Shared${index % 50}` }
await put('large/openapi.json', { openapi: '3.1.0', info: { title: 'Synthetic enterprise-scale corpus', version: '1' }, tags: Array.from({ length: 30 }, (_, index) => ({ name: `domain${index}` })), paths: largePaths, components: { schemas: largeSchemas } })
for (const suffix of ['a', 'b']) {
  const schemas = { Entity: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, state: { enum: ['active', 'disabled'] } } } }
  for (let index = 0; index < 50; index += 1) schemas[`Shared${index}`] = { type: 'object', properties: { name: { type: 'string' }, child: index ? { $ref: `#/Shared${index - 1}` } : { type: 'string' } } }
  await put(`large/schemas-${suffix}.json`, schemas)
}

const pathologicalPaths = {}
for (let index = 0; index < 600; index += 1) pathologicalPaths[`/missing/${index}`] = { get: { tags: ['missing'], description: 'x'.repeat(1_000), responses: { 200: { description: 'ok' } } } }
const deep = { type: 'string' }
let cursor = deep
for (let index = 0; index < 120; index += 1) cursor = cursor.items = { type: 'array' }
await put('pathological/bounded.json', {
  openapi: '3.2.0', info: { title: 'Bounded pathological corpus', version: '1', summary: 'compatible read' }, paths: pathologicalPaths,
  components: { schemas: { Entity: { type: 'string' }, Deep: deep, HugeEnum: { type: 'string', enum: Array.from({ length: 5_000 }, (_, index) => `value-${index}`) }, Escaped: { $ref: '#/components/schemas/a~1b' }, 'a/b': { type: 'object' }, Cycle: { $ref: '#/components/schemas/Cycle' } } },
})

await put('generation/openapi.json', { openapi: '3.1.0', info: { title: 'Generation corpus', version: '1' }, tags: Array.from({ length: 30 }, (_, index) => ({ name: `domain${index}` })), paths: Object.fromEntries(Object.entries(largePaths).slice(0, 250)), components: { schemas: { Entity: { type: 'object', properties: { id: { type: 'string' } } } } } })
await put('generation/openapi.config.cjs', `module.exports = {
  servers: [{ name: 'evaluation', input: { path: 'packages/mcp/src/evaluation/fixtures/generation/openapi.json' }, output: { dir: 'mcp-evaluation-output', clean: true } }],
  plugins: [{ name: 'evaluation-artifacts', hooks: { buildStart(ctx) {
    const paths = Object.keys(ctx.openAPIDocument.paths || {}).sort();
    for (const [index, apiPath] of paths.entries()) ctx.addArtifact({ kind: 'text', path: [ctx.openapiToSingleConfig.output.dir, '/operation-', String(index).padStart(4, '0'), '.txt'].join(''), content: [apiPath, '\\n'].join('') });
  } } }]
};
`)

const metadata = {
  schemaVersion: 1,
  provenance: { source: 'Synthetic fixtures created for openapi-to P2.5', license: 'MIT', acquired: '2026-07-18', cropped: false, secretsRemoved: true },
  fixtures: [
    { id: 'small-3.0', file: 'small/openapi-3.0.json', openapiVersion: '3.0.3', paths: 1, operations: 1, schemas: 1, externalRefs: 0, expected: ['validate', 'inspect'] },
    { id: 'small-3.1', file: 'small/openapi-3.1.json', openapiVersion: '3.1.0', paths: 1, operations: 1, schemas: 1, externalRefs: 0, expected: ['validate', 'inspect'] },
    { id: 'small-3.2', file: 'small/openapi-3.2.json', openapiVersion: '3.2.0', paths: 1, operations: 1, schemas: 1, externalRefs: 0, expected: ['compatible-read warning'] },
    { id: 'small-swagger', file: 'small/swagger-2.0.json', openapiVersion: '2.0', paths: 1, operations: 1, schemas: 0, externalRefs: 0, expected: ['conversion info'] },
    { id: 'medium', file: 'medium/openapi.json', openapiVersion: '3.1.0', paths: 150, operations: 150, schemas: 81, externalRefs: 81, expected: ['bounded inspect'] },
    { id: 'large', file: 'large/openapi.json', openapiVersion: '3.1.0', paths: 700, operations: 700, schemas: 301, externalRefs: 301, expected: ['operation and artifact truncation'] },
    { id: 'pathological', file: 'pathological/bounded.json', openapiVersion: '3.2.0', paths: 600, operations: 600, schemas: 6, externalRefs: 0, expected: ['bounded warnings', 'cycle preservation', 'long text not returned'] },
    { id: 'generation', file: 'generation/openapi.json', openapiVersion: '3.1.0', paths: 250, operations: 250, schemas: 1, externalRefs: 0, expected: ['250 deterministic text artifacts', 'no writes'] },
  ],
}
for (const fixture of metadata.fixtures) fixture.bytes = (await stat(path.join(root, fixture.file))).size
await put('metadata.json', metadata)
