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
  timeouts?: OpenapiToMcpTimeoutOptions
  logFormat?: 'text' | 'json'
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
}

export interface OpenapiToMcpTimeoutOptions {
  validateMs?: number
  inspectMs?: number
  diffMs?: number
  generationMs?: number
}

export interface ResolvedMcpTimeouts {
  validateMs: number
  inspectMs: number
  diffMs: number
  generationMs: number
}

export interface ResolvedMcpLimits {
  maxDiagnostics: number
  maxChanges: number
  maxArtifacts: number
  maxTextBytes: number
  maxPreviewBytes: number
}

export interface ResolvedMcpServerOptions extends Omit<OpenapiToMcpServerOptions, 'workspaceRoot' | 'limits' | 'timeouts'> {
  workspaceRoot: string
  limits: ResolvedMcpLimits
  timeouts: ResolvedMcpTimeouts
}

const DEFAULT_LIMITS: ResolvedMcpLimits = {
  maxDiagnostics: 100,
  maxChanges: 500,
  maxArtifacts: 200,
  maxTextBytes: 256 * 1024,
  maxPreviewBytes: 32 * 1024,
}

export const DEFAULT_TIMEOUTS: ResolvedMcpTimeouts = {
  validateMs: 30_000,
  inspectMs: 30_000,
  diffMs: 45_000,
  generationMs: 60_000,
}

export const MIN_TOOL_TIMEOUT_MS = 100
export const MAX_TOOL_TIMEOUT_MS = 10 * 60_000

function positiveInteger(value: number | undefined, fallback: number): number {
  return value === undefined ? fallback : Math.max(1, Math.floor(value))
}

function timeoutMilliseconds(name: string, value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < MIN_TOOL_TIMEOUT_MS || value > MAX_TOOL_TIMEOUT_MS) {
    throw new RangeError(`${name} must be an integer from ${MIN_TOOL_TIMEOUT_MS} to ${MAX_TOOL_TIMEOUT_MS} milliseconds.`)
  }
  return value
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
    timeouts: {
      validateMs: timeoutMilliseconds('timeouts.validateMs', options.timeouts?.validateMs, DEFAULT_TIMEOUTS.validateMs),
      inspectMs: timeoutMilliseconds('timeouts.inspectMs', options.timeouts?.inspectMs, DEFAULT_TIMEOUTS.inspectMs),
      diffMs: timeoutMilliseconds('timeouts.diffMs', options.timeouts?.diffMs, DEFAULT_TIMEOUTS.diffMs),
      generationMs: timeoutMilliseconds('timeouts.generationMs', options.timeouts?.generationMs, DEFAULT_TIMEOUTS.generationMs),
    },
    logFormat: options.logFormat ?? 'text',
    logLevel: options.logLevel ?? 'info',
  }
}
