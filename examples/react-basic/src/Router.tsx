import React from 'react'
import navaid, { Router as NavAid } from 'navaid'
import { routes, RouteModule } from 'saus/client'

let router: NavAid | undefined
let setPage: (page: JSX.Element) => void
let nextPage: Promise<void> | undefined

// SPA effect by hi-jacking clicks to anchor elements.
if (!import.meta.env.SSR) {
  document.addEventListener('click', event => {
    const target = event.target as HTMLElement
    if (target.tagName === 'A') {
      const href = target.getAttribute('href')
      if (href?.startsWith('/')) {
        event.preventDefault()
        visit(href)
      }
    }
  })
}

export function visit(path: string, replace?: boolean) {
  if (import.meta.env.SSR) {
    // no-op
  } else if (router) {
    router.route(path, replace)
  } else {
    router = navaid()
    for (const route of Object.keys(routes).reverse()) {
      router.on(route, (params = {}) => {
        // The initial route is pre-rendered, so we can bail out.
        if (nextPage == null) {
          return (nextPage = Promise.resolve())
        }
        const page = (nextPage = routes[route]().then(module => {
          if (page == nextPage) {
            setPage(renderRoute(module, params))
          }
        }))
      })
    }
    router.listen()
  }
}

// This function needs to match what the server does.
// TODO: It should probably be generated?
function renderRoute(mod: RouteModule, params: Record<string, string>) {
  const Page = mod.default as React.ComponentType<any>
  return <Page {...params} />
}

// Do not use this router in production. It is too naïve.
export function Router(props: { children: JSX.Element }) {
  const [page, _setPage] = React.useState(props.children)
  setPage = _setPage
  return page
}
