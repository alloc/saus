/**
 * Inlined assets are encoded with Base64.
 *
 * If assets are not inlined, the value is an ETag header.
 */
const clientAssets: Record<string, string> = (globalThis as any)
  .sausClientAssets

// Stub module replaced at build time.
export default clientAssets
