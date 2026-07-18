import { realpathSync } from 'node:fs'
import path from 'node:path'

export interface OpenapiToMcpServerOptions {
  workspaceRoot: string
  configPath?: string
  remote?: {
    allowPrivateNetwork?: boolean
    allowedHosts?: string[]
  }
  limits?: {
    maxDiagnostics?: number
    maxChanges?: number
    maxArtifacts?: number
    maxTextBytes?: number
    maxPreviewBytes?: number
  }
}

export interface ResolvedMcpLimits {
  maxDiagnostics: number
  maxChanges: number
  maxArtifacts: number
  maxTextBytes: number
  maxPreviewBytes: number
}

export interface ResolvedMcpServerOptions extends Omit<OpenapiToMcpServerOptions, 'workspaceRoot' | 'limits'> {
  workspaceRoot: string
  limits: ResolvedMcpLimits
}

const DEFAULT_LIMITS: ResolvedMcpLimits = {
  maxDiagnostics: 100,
  maxChanges: 500,
  maxArtifacts: 200,
  maxTextBytes: 256 * 1024,
  maxPreviewBytes: 32 * 1024,
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value === undefined ? fallback : Math.max(1, Math.floor(value))
}

export function resolveMcpServerOptions(options: OpenapiToMcpServerOptions): ResolvedMcpServerOptions {
  const workspaceRoot = realpathSync(path.resolve(options.workspaceRoot))
  return {
    ...options,
    workspaceRoot,
    remote: {
      allowPrivateNetwork: options.remote?.allowPrivateNetwork === true,
      allowedHosts: [...new Set(options.remote?.allowedHosts ?? [])].sort(),
    },
    limits: {
      maxDiagnostics: positiveInteger(options.limits?.maxDiagnostics, DEFAULT_LIMITS.maxDiagnostics),
      maxChanges: positiveInteger(options.limits?.maxChanges, DEFAULT_LIMITS.maxChanges),
      maxArtifacts: positiveInteger(options.limits?.maxArtifacts, DEFAULT_LIMITS.maxArtifacts),
      maxTextBytes: positiveInteger(options.limits?.maxTextBytes, DEFAULT_LIMITS.maxTextBytes),
      maxPreviewBytes: positiveInteger(options.limits?.maxPreviewBytes, DEFAULT_LIMITS.maxPreviewBytes),
    },
  }
}
