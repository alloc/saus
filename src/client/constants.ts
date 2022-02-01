/**
 * This variable is like `import.meta.env.BASE_URL` except it
 * equals the `debugBase` option when in debug view.
 *
 * You **must not** use this for asset URLs or you will break
 * them in the debug view. Only use this variable for links.
 */
export const BASE_URL = import.meta.env.BASE_URL
