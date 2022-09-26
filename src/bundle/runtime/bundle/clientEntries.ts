type ClientEntryId = string

export type ClientEntries = {
  [layoutModuleId: string]: {
    [routeModuleId: string]: ClientEntryId
  }
}

/**
 * Every combination of layout module + route module has its own
 * entry module loaded by the client, except for layouts without
 * a hydrator module. This mapping is used by the SSR bundle to
 * find the public URL for each entry module.
 *
 * The keys are SSR paths, which are identical to dev server paths.
 */
const clientEntries: ClientEntries = (globalThis as any).sausClientEntries

// Stub module replaced at build time.
export default clientEntries
