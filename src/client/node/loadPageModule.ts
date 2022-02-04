export function loadPageModule(routePath: string) {
  const load = (void 0, require)('../client/routes.cjs')[routePath]
  if (load) {
    return load()
  }
  throw Error(`Unknown route: "${routePath}"`)
}
