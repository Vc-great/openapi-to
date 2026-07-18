import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

import { McpToolError } from '../errors.ts'

const WINDOWS_ABSOLUTE = /^(?:[a-zA-Z]:[\\/]|\\\\)/

function outside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate)
  return relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)
}

export async function resolveWorkspacePath(workspaceRoot: string, input: string, options: { mustExist?: boolean } = {}): Promise<string> {
  if (process.platform !== 'win32' && WINDOWS_ABSOLUTE.test(input)) throw new McpToolError('MCP_WORKSPACE_PATH_OUTSIDE_ROOT', 'Windows drive and UNC paths are not valid in this Workspace.')
  const lexicalRoot = path.resolve(workspaceRoot)
  const canonicalRoot = await realpath(lexicalRoot)
  const candidate = path.resolve(lexicalRoot, input)
  if (outside(lexicalRoot, candidate)) throw new McpToolError('MCP_WORKSPACE_PATH_OUTSIDE_ROOT', 'The requested path is outside the configured Workspace.')
  if (options.mustExist !== false) {
    try {
      await lstat(candidate)
      const canonical = await realpath(candidate)
      if (outside(canonicalRoot, canonical)) throw new McpToolError('MCP_WORKSPACE_SYMLINK_ESCAPE', 'The requested path escapes the configured Workspace through a symlink.')
      return canonical
    } catch (error) {
      if (error instanceof McpToolError) throw error
      throw new McpToolError('MCP_TOOL_EXECUTION_FAILED', 'The requested Workspace path does not exist or is unreadable.')
    }
  }
  let ancestor = candidate
  for (;;) {
    try {
      const canonicalAncestor = await realpath(ancestor)
      if (outside(canonicalRoot, canonicalAncestor)) throw new McpToolError('MCP_WORKSPACE_SYMLINK_ESCAPE', 'The requested path escapes the configured Workspace through a symlink.')
      return candidate
    } catch (error) {
      if (error instanceof McpToolError) throw error
      const parent = path.dirname(ancestor)
      if (parent === ancestor) throw new McpToolError('MCP_WORKSPACE_PATH_OUTSIDE_ROOT', 'Unable to establish a safe Workspace path.')
      ancestor = parent
    }
  }
}

export function workspaceRelative(workspaceRoot: string, absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join('/') || '.'
}
