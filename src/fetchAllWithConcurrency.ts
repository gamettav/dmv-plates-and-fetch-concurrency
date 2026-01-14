export type Fetcher<T> = (url: string, signal?: AbortSignal) => Promise<T>

export type FetchAllWithConcurrencyOptions<T> = {
  maxConcurrency: number
  fetcher?: Fetcher<T>
  signal?: AbortSignal
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('Aborted')
}

function createLinkedAbortController(signal?: AbortSignal): AbortController {
  const controller = new AbortController()
  if (!signal) return controller

  const onAbort = () => controller.abort(signal.reason)
  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })

  return controller
}

const defaultFetcher: Fetcher<unknown> = async (url, signal) => {
  const fetchFn = (
    globalThis as { fetch?: (input: any, init?: any) => Promise<any> }
  ).fetch
  if (!fetchFn) {
    throw new Error('global fetch is not available; pass options.fetcher')
  }
  return fetchFn(url, { signal })
}

export async function fetchAllWithConcurrency<T>(
  urls: readonly string[],
  options: FetchAllWithConcurrencyOptions<T>
): Promise<T[]> {
  const { maxConcurrency, fetcher: customFetcher, signal } = options
  assertPositiveInteger(maxConcurrency, 'maxConcurrency')

  const controller = createLinkedAbortController(signal)
  const effectiveSignal = controller.signal
  const fetcher = (customFetcher ?? defaultFetcher) as Fetcher<T>

  const results: T[] = new Array(urls.length)
  let nextIndex = 0
  let stopped = false

  const worker = async () => {
    while (true) {
      if (stopped) return
      if (effectiveSignal.aborted) throw abortReason(effectiveSignal)

      const i = nextIndex++
      if (i >= urls.length) return
      try {
        results[i] = await fetcher(urls[i], effectiveSignal)
      } catch (err) {
        if (!stopped) {
          stopped = true
          controller.abort(err)
        }
        throw err
      }
    }
  }

  const workerCount = Math.min(maxConcurrency, urls.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}

export async function fetchAllWithConcurrencySettled<T>(
  urls: readonly string[],
  options: FetchAllWithConcurrencyOptions<T>
): Promise<PromiseSettledResult<T>[]> {
  const { maxConcurrency, fetcher: customFetcher, signal } = options
  assertPositiveInteger(maxConcurrency, 'maxConcurrency')

  const controller = createLinkedAbortController(signal)
  const effectiveSignal = controller.signal
  const fetcher = (customFetcher ?? defaultFetcher) as Fetcher<T>

  const results: PromiseSettledResult<T>[] = new Array(urls.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      if (effectiveSignal.aborted) throw abortReason(effectiveSignal)

      const i = nextIndex++
      if (i >= urls.length) return

      try {
        results[i] = {
          status: 'fulfilled',
          value: await fetcher(urls[i], effectiveSignal)
        }
      } catch (err) {
        results[i] = { status: 'rejected', reason: err }
      }
    }
  }

  const workerCount = Math.min(maxConcurrency, urls.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}
