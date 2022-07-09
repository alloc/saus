import { Promisable } from 'type-fest'
import { Endpoint } from '../endpoint'
import type { RouteLayout } from './layouts'
import { getCurrentModule } from './ssrModules'

export interface LayoutRenderer<RenderResult = any> {
  /** Serialize the SSR result of a layout's `render` method. */
  serialize: (result: RenderResult) => Promisable<Endpoint.Utf8>
  /** Path to module responsible for hydrating the client. */
  hydrator?: string
  /** Modify the `<head>` of every layout using this renderer. */
  head?: RouteLayout<any, any, any, RenderResult>['head']
}

/**
 * Layout renderers control how a layout is rendered
 * in both server and client environments.
 *
 * This function is excluded from client bundles, because of
 * the `../plugins/clientLayout` module.
 */
export const defineLayoutRenderer = <RenderResult>({
  serialize: toString,
  hydrator,
  head: getGlobalHead,
}: LayoutRenderer<RenderResult>) =>
  function <
    ClientProps extends object = any,
    ServerProps extends object = any,
    RouteModule extends object = any
  >(
    config: RouteLayout<ClientProps, ServerProps, RouteModule, RenderResult>
  ): RouteLayout<ClientProps, ServerProps, RouteModule, Endpoint.Utf8> {
    const { head: getHead, render } = config
    if (getGlobalHead) {
      config.head = async req => {
        const head = await Promise.all([getGlobalHead(req), getHead?.(req)])
        return head.join('\n')
      }
    }
    config.render = async req => {
      const rendered = await render(req)
      return toString(rendered) as any
    }
    config.hydrator ||= hydrator
    config.file = getCurrentModule()
    return config as any
  }
