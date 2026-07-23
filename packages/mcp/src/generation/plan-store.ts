import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

import { McpToolError } from '../errors.ts'

export interface StoredGenerationPlan {
  schemaVersion: 1
  kind: 'full' | 'selective'
  planId: string
  planHash: string
  authorizationContextHash: string
  createdAt: number
  expiresAt: number
  workspaceHash: string
  target: string
  outputRoot: string
  byteSize: number
}

interface PlanEntry<T extends StoredGenerationPlan> {
  plan: T
  token: string
  state: 'active' | 'used'
  lastAccessed: number
}

export interface GenerationPlanStoreOptions {
  ttlMs: number
  maxPlans: number
  maxPlanBytes: number
  maxTotalPlanBytes: number
  onEvent?: (event: 'expired' | 'evicted' | 'cleared', plan: StoredGenerationPlan) => void
}

export class GenerationPlanStore<T extends StoredGenerationPlan> {
  readonly processNonce = randomBytes(16).toString('hex')
  private readonly secret = randomBytes(32)
  private readonly entries = new Map<string, PlanEntry<T>>()
  private readonly cleanupTimer: NodeJS.Timeout
  private totalBytes = 0
  private accessSequence = 0

  constructor(private readonly options: GenerationPlanStoreOptions) {
    this.cleanupTimer = setInterval(() => this.cleanup(), Math.min(options.ttlMs, 30_000))
    this.cleanupTimer.unref()
  }

  create(plan: Omit<T, 'planId' | 'createdAt' | 'expiresAt'>): { plan: T; token: string } {
    const createdAt = Date.now()
    const complete = {
      ...plan,
      planId: randomUUID(),
      createdAt,
      expiresAt: createdAt + this.options.ttlMs,
    } as T
    if (complete.byteSize > this.options.maxPlanBytes) {
      throw new McpToolError('MCP_PLAN_TOO_LARGE', 'The complete generation plan exceeds the configured per-plan memory limit.')
    }
    this.cleanup()
    while (this.entries.size >= this.options.maxPlans || this.totalBytes + complete.byteSize > this.options.maxTotalPlanBytes) {
      const oldest = [...this.entries.values()].sort((left, right) => left.lastAccessed - right.lastAccessed || left.plan.planId.localeCompare(right.plan.planId))[0]
      if (!oldest) break
      this.deleteEntry(oldest.plan.planId, 'evicted')
    }
    if (this.entries.size >= this.options.maxPlans || this.totalBytes + complete.byteSize > this.options.maxTotalPlanBytes) {
      throw new McpToolError('MCP_PLAN_STORE_FULL', 'The in-memory generation plan store cannot accept another plan within its configured limits.')
    }
    const token = this.sign(complete)
    this.entries.set(complete.planId, { plan: complete, token, state: 'active', lastAccessed: ++this.accessSequence })
    this.totalBytes += complete.byteSize
    return { plan: complete, token }
  }

  verify(planId: string, token: string, approvedPlanHash: string): T {
    const entry = this.entries.get(planId)
    if (!entry) throw new McpToolError('MCP_PLAN_NOT_FOUND', 'The generation plan does not exist in this MCP Server instance.')
    entry.lastAccessed = ++this.accessSequence
    if (entry.plan.expiresAt <= Date.now()) throw new McpToolError('MCP_PLAN_EXPIRED', 'The generation plan has expired; prepare a new plan before writing.')
    if (entry.state === 'used') throw new McpToolError('MCP_PLAN_ALREADY_USED', 'The generation plan token has already been consumed and cannot be replayed.')
    if (entry.plan.planHash !== approvedPlanHash) throw new McpToolError('MCP_PLAN_HASH_MISMATCH', 'The approved plan hash does not match the prepared generation plan.')
    // Compare the canonical encoded token, not only its decoded bytes. Base64url
    // permits non-canonical final characters whose unused bits decode to the
    // same MAC; accepting those aliases weakens exact one-time token binding.
    const expected = Buffer.from(entry.token, 'utf8')
    const supplied = Buffer.from(token, 'utf8')
    const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected)
    if (!valid) throw new McpToolError('MCP_PLAN_TOKEN_INVALID', 'The generation plan token is invalid for this Server, Workspace, or plan.')
    return entry.plan
  }

  consume(planId: string, token: string, approvedPlanHash: string): T {
    const plan = this.verify(planId, token, approvedPlanHash)
    const entry = this.entries.get(planId)
    if (!entry) throw new McpToolError('MCP_PLAN_NOT_FOUND', 'The generation plan no longer exists.')
    entry.state = 'used'
    entry.lastAccessed = ++this.accessSequence
    return plan
  }

  clear(): void {
    clearInterval(this.cleanupTimer)
    for (const entry of this.entries.values()) this.options.onEvent?.('cleared', entry.plan)
    this.entries.clear()
    this.totalBytes = 0
    this.secret.fill(0)
  }

  get size(): number {
    return this.entries.size
  }

  private sign(plan: T): string {
    return createHmac('sha256', this.secret)
      .update(JSON.stringify({
        schemaVersion: 1,
        processNonce: this.processNonce,
        planId: plan.planId,
        kind: plan.kind,
        planHash: plan.planHash,
        authorizationContextHash: plan.authorizationContextHash,
        target: plan.target,
        workspaceHash: plan.workspaceHash,
        expiresAt: plan.expiresAt,
      }))
      .digest('base64url')
  }

  private cleanup(now = Date.now()): void {
    for (const entry of this.entries.values()) {
      if (entry.plan.expiresAt + this.options.ttlMs <= now) this.deleteEntry(entry.plan.planId, 'expired')
    }
  }

  private deleteEntry(planId: string, event: 'expired' | 'evicted'): void {
    const entry = this.entries.get(planId)
    if (!entry) return
    this.entries.delete(planId)
    this.totalBytes -= entry.plan.byteSize
    this.options.onEvent?.(event, entry.plan)
  }
}
