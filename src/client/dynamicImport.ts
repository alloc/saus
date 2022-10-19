// We need this to avoid `import(...)` from being transformed into a
// `require` call by Esbuild.
export const dynamicImport = new Function('file', 'return import(file)')
