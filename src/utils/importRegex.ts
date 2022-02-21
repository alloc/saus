export const bareImportRE = /^[\w@][^:]/
export const relativePathRE = /^(?:\.\/|(\.\.\/)+)/

/** Similar to `relativePathRE` but it matches `@/` prefix too. */
export const internalPathRE = /^(?:[.@]\/|(\.\.\/)+)/
