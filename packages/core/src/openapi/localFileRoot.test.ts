import { mkdtemp, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { compileOpenAPI } from './compiler.ts'

describe('localFileRoot', () => {
  it('allows internal references and rejects transitive traversal', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-root-'))
    const outside = await mkdtemp(path.join(os.tmpdir(), 'openapi-outside-'))
    await writeFile(path.join(root, 'schema.yaml'), 'Pet: { type: object }\n')
    await writeFile(path.join(root, 'inside.yaml'), 'openapi: 3.1.0\ninfo: { title: Inside, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Pet: { $ref: "./schema.yaml#/Pet" }\n')
    expect((await compileOpenAPI(path.join(root, 'inside.yaml'), { localFileRoot: root })).success).toBe(true)

    await writeFile(path.join(outside, 'secret.yaml'), 'Secret: { type: string }\n')
    await writeFile(path.join(root, 'escape.yaml'), `openapi: 3.1.0\ninfo: { title: Escape, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Secret: { $ref: "${path.relative(root, path.join(outside, 'secret.yaml'))}#/Secret" }\n`)
    const escaped = await compileOpenAPI(path.join(root, 'escape.yaml'), { localFileRoot: root })
    expect(escaped.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LOCAL_SOURCE_OUTSIDE_ROOT' })]))
  })

  it('rejects symlink entry and reference escapes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-root-'))
    const outside = await mkdtemp(path.join(os.tmpdir(), 'openapi-outside-'))
    await writeFile(path.join(outside, 'secret.yaml'), 'openapi: 3.1.0\ninfo: { title: Secret, version: "1" }\npaths: {}\n')
    await symlink(path.join(outside, 'secret.yaml'), path.join(root, 'linked.yaml'))
    const entry = await compileOpenAPI(path.join(root, 'linked.yaml'), { localFileRoot: root })
    expect(entry.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LOCAL_SOURCE_SYMLINK_ESCAPE' })]))

    await writeFile(path.join(root, 'root.yaml'), 'openapi: 3.1.0\ninfo: { title: Root, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    Secret: { $ref: "./linked.yaml" }\n')
    const reference = await compileOpenAPI(path.join(root, 'root.yaml'), { localFileRoot: root })
    expect(reference.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LOCAL_SOURCE_SYMLINK_ESCAPE' })]))
  })
})
