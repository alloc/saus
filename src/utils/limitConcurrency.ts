import os from 'os'
import { limitByQueue } from './limitByQueue'

type AsyncFn = (...args: any[]) => Promise<any>

/**
 * Prevent too many pending calls at one time.
 *
 * If `limit` is null, then `os.cpus().length` is used.
 */
export function limitConcurrency<T extends AsyncFn>(
  limit: number | null,
  fn: T,
  pre?: (...args: Parameters<T>) => void
) {
  const maxConcurrency = limit == null ? os.cpus().length : limit
  return limitByQueue(
    activeCalls => activeCalls.size == maxConcurrency,
    fn,
    pre
  )
}
