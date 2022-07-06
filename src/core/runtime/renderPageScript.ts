import endent from 'endent'

export function renderPageScript(opts: {
  pageStateId: string
  routeClientId: string
  sausClientId: string
  catchHandler?: string
}) {
  // NOTE: The route client is loaded with `import(...)` because static imports
  // are loaded in parallel and executed in a non-deterministic order, and the
  // page state needs to be injected into the global cache before any top-level
  // route/layout code runs (which may depend on page state).
  // This won't delay page hydration, since the route client is pre-loaded in
  // the <head> element.
  return endent`
    import props from "${opts.pageStateId}"
    import * as Saus from "${opts.sausClientId}"

    import("${opts.routeClientId}").then(({ default: client }) => {
      Saus.hydrate(client, props, document.getElementById("root"))${
        opts.catchHandler ? `.catch(${opts.catchHandler})` : ``
      }
    })
  `
}
