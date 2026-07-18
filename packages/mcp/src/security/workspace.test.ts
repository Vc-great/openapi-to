import { mkdir, mkdtemp, realpath, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { sanitizeSourceDisplay } from './source.ts'
import { resolveWorkspacePath } from './workspace.ts'

describe('MCP Workspace security', () => {
  it('allows real Workspace paths and rejects traversal and Windows paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-workspace-'))
    await writeFile(path.join(root, 'openapi.yaml'), 'openapi: 3.1.0')
    await expect(resolveWorkspacePath(root, 'openapi.yaml')).resolves.toBe(await realpath(path.join(root, 'openapi.yaml')))
    await expect(resolveWorkspacePath(root, '../outside.yaml')).rejects.toMatchObject({ diagnostics: [{ code: 'MCP_WORKSPACE_PATH_OUTSIDE_ROOT' }] })
    if (process.platform !== 'win32') {
      await expect(resolveWorkspacePath(root, 'C:\\outside.yaml')).rejects.toMatchObject({ diagnostics: [{ code: 'MCP_WORKSPACE_PATH_OUTSIDE_ROOT' }] })
      await expect(resolveWorkspacePath(root, '\\\\server\\share\\outside.yaml')).rejects.toMatchObject({ diagnostics: [{ code: 'MCP_WORKSPACE_PATH_OUTSIDE_ROOT' }] })
    }
  })

  it('rejects entry and output symlink escapes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-workspace-'))
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mcp-outside-'))
    await writeFile(path.join(outside, 'secret.yaml'), 'secret')
    await symlink(outside, path.join(root, 'link'))
    await expect(resolveWorkspacePath(root, 'link/secret.yaml')).rejects.toMatchObject({ diagnostics: [{ code: 'MCP_WORKSPACE_SYMLINK_ESCAPE' }] })
    await mkdir(path.join(outside, 'generated'))
    await expect(resolveWorkspacePath(root, 'link/generated', { mustExist: false })).rejects.toMatchObject({ diagnostics: [{ code: 'MCP_WORKSPACE_SYMLINK_ESCAPE' }] })
  })

  it('redacts URL credentials and query strings', () => {
    expect(sanitizeSourceDisplay('/workspace', 'https://user:pass@example.com/spec.yaml?token=secret#part')).toBe('https://example.com/spec.yaml#part')
    expect(sanitizeSourceDisplay('/workspace', '/outside/secret.yaml')).toBe('[outside-workspace]')
    expect(sanitizeSourceDisplay('/workspace', 'file:///outside/secret.yaml')).toBe('[local-file-url]')
  })
})
