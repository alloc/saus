import React from 'react'
import navaid, { Router as NavAid } from 'navaid'
import { routes, RouteModule, RouteParams } from 'saus/client'

// Respect BASE_URL injected by Vite.
const base = import.meta.env.BASE_URL.replace(/^\//, '')

let router: NavAid | undefined
let setPage: (page: JSX.Element) => void
let nextPage: Promise<void> | undefined

// Probably not production ready. Use with caution!
export function Router(props: { children: JSX.Element }) {
  const [page, _setPage] = React.useState(props.children)
  setPage = _setPage
  return page
}

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
  if (!import.meta.env.SSR) {
    router ||= Object.keys(routes)
      // Check routes in reverse order, like the server does.
      .reverse()
      // Exclude the default route.
      .slice(1)
      .reduce(
        (router, route) => router.on(route, loadPage.bind(null, route)),
        navaid(base, () => loadPage('default')).listen()
      )
    router.route(path, replace)
  }
}

function loadPage(route: string, params?: RouteParams) {
  // The initial page is pre-rendered, so skip the first call.
  if (!router) return

  // Bail out if the route changes while loading.
  const page = (nextPage = routes[route]().then(module => {
    if (page == nextPage) {
      setPage(renderPage(module, params || {}))
    }
  }))
}

// This function needs to match what the server does.
// TODO: It should probably be generated?
function renderPage(mod: RouteModule, params: RouteParams) {
  const Page = mod.default as React.ComponentType<any>
  return <Page {...params} />
}
