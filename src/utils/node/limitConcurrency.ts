import os from 'os'
import { ExecutionGateContext } from '../controlExecution'

const cpuCount = os.cpus().length

/**
 * Prevent too many active calls at one time.
 *
 * If `limit` is null or undefined, then `os.cpus().length` is used.
 */
export function limitConcurrency(limit?: number | null) {
  const maxConcurrency = limit == null ? cpuCount : limit
  return (ctx: ExecutionGateContext, wasQueued?: boolean) => {
    const availableCalls = maxConcurrency - ctx.activeCalls.size
    if (!wasQueued && ctx.queuedCalls.length >= availableCalls) {
      return false
    }
    return availableCalls > 0
  }
}
