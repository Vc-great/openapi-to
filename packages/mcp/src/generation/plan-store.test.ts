import { describe, expect, it, vi } from 'vitest'
import { GenerationPlanStore, type StoredGenerationPlan } from './plan-store.ts'

interface TestPlan extends StoredGenerationPlan {
  marker: string
}

function createStore(overrides: Partial<ConstructorParameters<typeof GenerationPlanStore<TestPlan>>[0]> = {}) {
  return new GenerationPlanStore<TestPlan>({ ttlMs: 20, maxPlans: 2, maxPlanBytes: 1000, maxTotalPlanBytes: 2000, ...overrides })
}

function add(store: GenerationPlanStore<TestPlan>, marker: string, byteSize = 100) {
  return store.create({ schemaVersion: 1, planHash: marker.padEnd(64, '0'), workspaceHash: 'workspace', target: 'main', outputRoot: '/workspace/output', byteSize, marker })
}

describe('GenerationPlanStore', () => {
  it('uses tamper-evident one-time tokens and exact approved hashes', () => {
    const store = createStore()
    const created = add(store, 'a')
    expect(() => store.verify(created.plan.planId, `${created.token.slice(0, -1)}x`, created.plan.planHash)).toThrow(/token/i)
    expect(() => store.verify(created.plan.planId, created.token, 'f'.repeat(64))).toThrow(/hash/i)
    expect(store.consume(created.plan.planId, created.token, created.plan.planHash)).toBe(created.plan)
    expect(() => store.consume(created.plan.planId, created.token, created.plan.planHash)).toThrow(/already/i)
    store.clear()
  })

  it('expires plans and makes tokens from another Server instance invalid', () => {
    vi.useFakeTimers()
    const left = createStore()
    const right = createStore()
    try {
      const created = add(left, 'b')
      expect(() => right.verify(created.plan.planId, created.token, created.plan.planHash)).toThrow(/does not exist/i)
      vi.advanceTimersByTime(21)
      expect(() => left.verify(created.plan.planId, created.token, created.plan.planHash)).toThrow(/expired/i)
    } finally {
      left.clear()
      right.clear()
      vi.useRealTimers()
    }
  })

  it('enforces per-plan and total/count limits with deterministic LRU eviction', () => {
    const store = createStore({ maxPlanBytes: 150, maxTotalPlanBytes: 200, maxPlans: 2 })
    expect(() => add(store, 'large', 151)).toThrow(/per-plan/i)
    const first = add(store, 'c', 100)
    const second = add(store, 'd', 100)
    const third = add(store, 'e', 100)
    expect(store.size).toBe(2)
    expect(() => store.verify(first.plan.planId, first.token, first.plan.planHash)).toThrow(/does not exist/i)
    expect(store.verify(second.plan.planId, second.token, second.plan.planHash)).toBe(second.plan)
    expect(store.verify(third.plan.planId, third.token, third.plan.planHash)).toBe(third.plan)
    store.clear()
  })
})
