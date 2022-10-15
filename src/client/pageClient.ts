import { CommonClientProps } from '@runtime/clientTypes'
import { getPagePath } from '@runtime/getPagePath'
import { RouteParams } from '@runtime/routeTypes'
import { noop } from '@utils/noop'
import { AnyToObject } from '@utils/types'
import { RouteEntry } from '../core/routeEntries'
import { applyHead, injectLinkTag } from './head'
import { loadPageState } from './loadPageState'
import routes from './routes'

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
): Promise<PageClient<Props, Module, RenderResult>>

export async function loadPageClient<
  Props extends object = any,
  Module extends object = any,
  RenderResult = any
>(
  routePath: string,
  routeParams: RouteParams | null | undefined,
  signal: AbortSignal
): Promise<PageClient<Props, Module, RenderResult> | null>

export async function loadPageClient<
  Props extends object = any,
  Module extends object = any,
  RenderResult = any
>(
  routePath: string,
  routeParams?: RouteParams | null,
  signal?: AbortSignal
): Promise<PageClient<Props, Module, RenderResult> | null> {
  const clientUrl = routes[routePath]
  if (!clientUrl) {
    throw Error(`Unknown route: "${routePath}"`)
  }

  const pagePath =
    routePath !== 'default'
      ? getPagePath(routePath, routeParams)
      : saus.defaultPath

  try {
    injectLinkTag(clientUrl)

    const pageProps = await loadPageState<Props>(pagePath)
    if (signal?.aborted) {
      return null
    }

    // Add any desired <link> tags and update the <title> tag
    // before executing the route entry.
    applyHead(pagePath)

    const clientModule = await import(/* @vite-ignore */ clientUrl)
    return {
      ...clientModule,
      props: pageProps,
    }
  } catch (error: any) {
    if (signal?.aborted) {
      return null
    }
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
