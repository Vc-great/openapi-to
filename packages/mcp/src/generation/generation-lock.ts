export class GenerationLock {
  private tail: Promise<void> = Promise.resolve()

  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const previous = this.tail
    let release!: () => void
    const completion = new Promise<void>((resolve) => {
      release = resolve
    })
    this.tail = previous.then(() => completion)
    let acquired = false
    const waitForTurn = signal
      ? new Promise<void>((resolve, reject) => {
          const abort = () => reject(signal.reason ?? new Error('Generation wait cancelled.'))
          if (signal.aborted) abort()
          else {
            signal.addEventListener('abort', abort, { once: true })
            previous.then(resolve, resolve).finally(() => signal.removeEventListener('abort', abort))
          }
        })
      : previous
    try {
      await waitForTurn
      acquired = true
      if (signal?.aborted) throw signal.reason
      return await operation()
    } finally {
      if (acquired) release()
      else void previous.finally(release)
    }
  }
}
