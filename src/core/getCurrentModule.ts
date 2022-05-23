import { getStackFrame } from '../utils/stack'

/**
 * Used by the `route` function to resolve the entry module ID
 * of a generated route relative to the caller.
 *
 * In SSR bundles, this function is swapped out for an implementation
 * that introspects the in-memory SSR module system (see `../bundle/ssrModules.ts`).
 */
export function getCurrentModule() {
  return getStackFrame(2)?.file
}
