export function unwrapDefault(module: any) {
  const props = Object.getOwnPropertyNames(module)
  if (props.length == 1 && props[0] == 'default') {
    return module.default
  }
  return module
}
