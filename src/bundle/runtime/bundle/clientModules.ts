/**
 * If modules are not inlined, the value is an ETag header.
 */
const clientModules: Record<string, string> = (globalThis as any)
  .sausClientModules

// Stub module replaced at build time.
export default clientModules
