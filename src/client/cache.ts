/**
 * To avoid duplicate promises for the same state, we keep track
 * of which state is loading.
 *
 * Keys may be a page URL or a user-provided state module identifier.
 */
export const loadingStateCache = new Map<string, Promise<any>>()

/**
 * Keys may be a page URL or a user-provided state module identifier.
 */
export const loadedStateCache = new Map<string, any>()
