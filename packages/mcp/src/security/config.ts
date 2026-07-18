import { resolveWorkspacePath, workspaceRelative } from './workspace.ts'

export async function resolveTrustedConfigPath(workspaceRoot: string, configPath: string): Promise<{ absolutePath: string; displayPath: string }> {
  const absolutePath = await resolveWorkspacePath(workspaceRoot, configPath)
  return { absolutePath, displayPath: workspaceRelative(workspaceRoot, absolutePath) }
}
