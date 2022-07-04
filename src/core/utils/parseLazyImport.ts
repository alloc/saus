const importRE = /\b\(["']([^"']+)["']\)/

export const parseLazyImport = (fn: Function) => {
  const match = importRE.exec(fn.toString())
  return match && match[1]
}
