import os from 'os'
import { ExecutionGateContext } from './controlExecution'

/**
 * Prevent too many active calls at one time. Pass this to
 * the `controlExecution(…).with` method.
 *
 * If `limit` is null, then `os.cpus().length` is used.
 */
export function limitConcurrency(limit: number | null) {
  const maxConcurrency = limit == null ? os.cpus().length : limit
  return (ctx: ExecutionGateContext) => {
    return ctx.queuedCalls.length + ctx.activeCalls.size < maxConcurrency
  }
}
