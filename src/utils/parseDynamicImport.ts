const importRE = /\b\(["']([^"']+)["']\)/

export function parseDynamicImport(fn: Function, path: string) {
  try {
    return importRE.exec(fn.toString())![1]
  } catch (e: any) {
    throw Error(`Failed to parse "moduleId" for route: "${path}"\n` + e.message)
  }
}
