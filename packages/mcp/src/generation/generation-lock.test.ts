import { describe, expect, it } from 'vitest'

import { GenerationLock } from './generation-lock.ts'

describe('GenerationLock', () => {
  it('serializes one instance and releases after failure', async () => {
    const lock = new GenerationLock()
    const events: string[] = []
    const first = lock.run(async () => {
      events.push('first:start')
      await Promise.resolve()
      events.push('first:end')
      throw new Error('expected')
    })
    const second = lock.run(async () => {
      events.push('second:start')
      events.push('second:end')
    })
    await expect(first).rejects.toThrow('expected')
    await second
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('does not share state across server instances', async () => {
    const left = new GenerationLock()
    const right = new GenerationLock()
    let active = 0
    let maximum = 0
    const run = (lock: GenerationLock) => lock.run(async () => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
    })
    await Promise.all([run(left), run(right)])
    expect(maximum).toBe(2)
  })

  it('removes a cancelled waiter without blocking later work', async () => {
    const lock = new GenerationLock()
    let releaseFirst!: () => void
    const first = lock.run(() => new Promise<void>((resolve) => { releaseFirst = resolve }))
    const controller = new AbortController()
    const cancelled = lock.run(async () => undefined, controller.signal)
    const third = lock.run(async () => 'third')
    controller.abort(new Error('cancelled'))
    await expect(cancelled).rejects.toThrow('cancelled')
    releaseFirst()
    await first
    await expect(third).resolves.toBe('third')
  })
})
