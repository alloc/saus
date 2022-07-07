import navaid, { Router as NavAid } from 'navaid'
import React from 'react'
import {
  getPagePath,
  loadPageClient,
  prependBase,
  RouteParams,
  routes,
} from 'saus/client'

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
      // Exclude the default route.
      .slice(1)
      .reduce(
        (router, route) => router.on(route, loadPage.bind(null, route)),
        navaid('/', () => loadPage('default')).listen()
      )
    router.route(path, replace)
  }
}

function loadPage(route: string, params?: RouteParams) {
  // The initial page is pre-rendered, so skip the first call.
  if (!router) return

  // Bail out if the route changes while loading.
  const page = (nextPage = loadPageClient(route, params).then(client => {
    if (page == nextPage) {
      const pagePath = getPagePath(route, params)
      const pageUrl = new URL(location.origin + prependBase(pagePath))
      setPage(
        client.layout.render({
          module: client.routeModule,
          params: params || {},
          path: pageUrl.pathname,
          query: pageUrl.search,
          props: client.props,
        })
      )
    }
  }))
}
