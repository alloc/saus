export function unwrapDefault(module: any) {
  const exported = Object.keys(module)
  if (exported.length == 1 && exported[0] == 'default') {
    return module.default
  }
  return module
}
