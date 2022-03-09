/**
 * The keys of this map are one of:
 *   - import statement
 *   - dev server URI
 *
 * The values are the file names assigned by Rollup, which are
 * relative to the `build.outDir` option in Vite config.
 */
const moduleMap: Record<string, string> = {}

// Stub module replaced at build time.
export default moduleMap
