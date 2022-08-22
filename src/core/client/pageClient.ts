import { getPagePath } from '@/utils/getPagePath'
import { AnyToObject } from '@/utils/types'
import type { CommonClientProps, RouteParams } from '../core'
import { RouteEntry } from '../routeEntries'
import { applyHead } from './head'
import { loadPageState } from './loadPageState'
import routes from './routes'
import { noop } from '../utils/noop'

export interface PageClient<
  Props extends object = any,
  Module extends object = any,
  RenderResult = any
> extends RouteEntry<Props, Module, RenderResult> {
  props: CommonClientProps & AnyToObject<Props, Record<string, any>>
}

/**
 * Load the layout module, route module, and page props.
 *
 * This function is client/server agnostic.
 */
export async function loadPageClient<
  Props extends object = any,
  Module extends object = any,
  RenderResult = any
>(
  routePath: string,
  routeParams?: RouteParams
): Promise<PageClient<Props, Module, RenderResult>> {
  const clientUrl = routes[routePath]
  if (!clientUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }

  const pagePath =
    routePath !== 'default'
      ? getPagePath(routePath, routeParams)
      : saus.defaultPath

  try {
    const pageProps = await loadPageState<Props>(pagePath)

    // Add any desired <link> tags and update the <title> tag
    // before executing the route entry.
    applyHead(pagePath)

    const clientModule = await import(/* @vite-ignore */ clientUrl)
    return {
      ...clientModule,
      props: pageProps,
    }
  } catch (error: any) {
    if (error.code == 'PAGE_404') {
      if (routes['default'] && routePath !== 'default') {
        return loadPageClient('default')
      }
    }
    if (routes['error']) {
      return loadPageClient('error')
    }
    throw error
  }
}

export async function preloadRouteClient(routePath: string) {
  const clientUrl = routes[routePath]
  if (clientUrl) {
    return import(/* @vite-ignore */ clientUrl).catch(noop)
  }
}
