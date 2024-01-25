export type PossiblePromise<T> = Promise<T> | T
export function isPromise<T>(result: PossiblePromise<T>): result is Promise<T> {
  return !!result && typeof (result as Promise<unknown>)?.then === 'function'
}
