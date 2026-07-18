import path from 'node:path'

import { resolveWorkspacePath, workspaceRelative } from './workspace.ts'

export interface SafeSource {
  input: string
  value: string
  display: string
  remote: boolean
}

export function sanitizeSourceDisplay(workspaceRoot: string, source: string): string {
  try {
    const url = new URL(source)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      url.username = ''
      url.password = ''
      url.search = ''
      return url.toString()
    }
    return url.protocol === 'file:' ? '[local-file-url]' : `${url.protocol}//[redacted]`
  } catch {
    // Local path.
  }
  if (path.isAbsolute(source) || /^(?:[a-zA-Z]:[\\/]|\\\\)/.test(source)) {
    const relativePath = path.relative(workspaceRoot, source)
    const inside = relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath)
    return inside ? workspaceRelative(workspaceRoot, source) : '[outside-workspace]'
  }
  return source.replaceAll('\\', '/')
}

export async function resolveToolSource(workspaceRoot: string, source: string): Promise<SafeSource> {
  try {
    const url = new URL(source)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const display = sanitizeSourceDisplay(workspaceRoot, url.toString())
      return { input: source, value: url.toString(), display, remote: true }
    }
    throw new Error('Unsupported URL protocol.')
  } catch (error) {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(source) && !/^[a-zA-Z]:[\\/]/.test(source)) throw error
    const absolutePath = await resolveWorkspacePath(workspaceRoot, source)
    return { input: source, value: absolutePath, display: workspaceRelative(workspaceRoot, absolutePath), remote: false }
  }
}
