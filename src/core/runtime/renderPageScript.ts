import endent from 'endent'

export function renderPageScript(opts: {
  pageStateId: string
  routeClientId: string
  sausClientId: string
  catchHandler?: string
}) {
  return endent`
    import props from "${opts.pageStateId}"
    import * as Saus from "${opts.sausClientId}"

    import("${opts.routeClientId}").then(client => {
      Saus.hydrate(client, props, document.getElementById("root"))${
        opts.catchHandler ? `.catch(${opts.catchHandler})` : ``
      }
    })
  `
}
