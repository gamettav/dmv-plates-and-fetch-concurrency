import { describe, expect, it, vi } from 'vitest'
import {
  fetchAllWithConcurrency,
  fetchAllWithConcurrencySettled
} from './fetchAllWithConcurrency'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('fetchAllWithConcurrency', () => {
  it('caps concurrency, starts next ASAP, and preserves order', async () => {
    const urls = ['a', 'b', 'c', 'd', 'e'] as const
    const def = new Map<string, Deferred<string>>(
      urls.map(u => [u, deferred()])
    )
    const startedC = deferred<void>()

    let inFlight = 0
    let maxSeen = 0

    const fetcher = vi.fn((url: string, signal?: AbortSignal) => {
      inFlight++
      maxSeen = Math.max(maxSeen, inFlight)

      if (url === 'c') startedC.resolve()

      if (signal) {
        if (signal.aborted) def.get(url)!.reject(signal.reason)
        else
          signal.addEventListener(
            'abort',
            () => def.get(url)!.reject(signal.reason),
            { once: true }
          )
      }

      return def.get(url)!.promise.finally(() => {
        inFlight--
      })
    })

    const p = fetchAllWithConcurrency(urls, { maxConcurrency: 2, fetcher })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.map(([u]) => u)).toEqual(['a', 'b'])
    expect(inFlight).toBe(2)
    expect(maxSeen).toBeLessThanOrEqual(2)

    def.get('a')!.resolve('A')
    await startedC.promise

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.map(([u]) => u)).toEqual(['a', 'b', 'c'])
    expect(maxSeen).toBeLessThanOrEqual(2)

    def.get('c')!.resolve('C')
    def.get('b')!.resolve('B')
    def.get('e')!.resolve('E')
    def.get('d')!.resolve('D')

    await expect(p).resolves.toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(maxSeen).toBeLessThanOrEqual(2)
  })

  it('throws for invalid maxConcurrency', async () => {
    await expect(
      fetchAllWithConcurrency(['a'], {
        maxConcurrency: 0,
        fetcher: async () => 'ok'
      })
    ).rejects.toThrow(/maxConcurrency/i)
  })

  it('fails fast and does not schedule new work after an error', async () => {
    const urls = ['a', 'b', 'c'] as const
    const def = new Map<string, Deferred<string>>(
      urls.map(u => [u, deferred()])
    )

    const fetcher = vi.fn((url: string, signal?: AbortSignal) => {
      if (signal) {
        if (signal.aborted) def.get(url)!.reject(signal.reason)
        else
          signal.addEventListener(
            'abort',
            () => def.get(url)!.reject(signal.reason),
            { once: true }
          )
      }
      return def.get(url)!.promise
    })

    const p = fetchAllWithConcurrency(urls, { maxConcurrency: 2, fetcher })

    expect(fetcher.mock.calls.map(([u]) => u)).toEqual(['a', 'b'])

    def.get('b')!.reject(new Error('boom'))

    await expect(p).rejects.toThrow(/boom/)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('can be aborted via signal', async () => {
    const urls = ['a', 'b', 'c'] as const
    const def = new Map<string, Deferred<string>>(
      urls.map(u => [u, deferred()])
    )

    const controller = new AbortController()
    const fetcher = vi.fn((url: string, signal?: AbortSignal) => {
      if (signal) {
        if (signal.aborted) def.get(url)!.reject(signal.reason)
        else
          signal.addEventListener(
            'abort',
            () => def.get(url)!.reject(signal.reason),
            { once: true }
          )
      }
      return def.get(url)!.promise
    })

    const p = fetchAllWithConcurrency(urls, {
      maxConcurrency: 2,
      fetcher,
      signal: controller.signal
    })

    expect(fetcher.mock.calls.map(([u]) => u)).toEqual(['a', 'b'])

    controller.abort(new Error('stop'))
    await expect(p).rejects.toThrow(/stop/)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('returns Promise.allSettled-style results', async () => {
    const urls = ['a', 'b', 'c'] as const
    const def = new Map<string, Deferred<string>>(
      urls.map(u => [u, deferred()])
    )
    const err = new Error('nope')

    const fetcher = vi.fn((url: string) => def.get(url)!.promise)

    const p = fetchAllWithConcurrencySettled(urls, {
      maxConcurrency: 2,
      fetcher
    })

    def.get('a')!.resolve('A')
    def.get('b')!.reject(err)
    def.get('c')!.resolve('C')

    const out = await p
    expect(out[0]).toEqual({ status: 'fulfilled', value: 'A' })
    expect(out[1]).toEqual({ status: 'rejected', reason: err })
    expect(out[2]).toEqual({ status: 'fulfilled', value: 'C' })
  })
})
