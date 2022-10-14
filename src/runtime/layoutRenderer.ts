import { Promisable } from 'type-fest'
import type { RouteLayout } from './layouts'
import { getCurrentModule } from './ssrModules'

export interface LayoutRenderer<RenderResult = any> {
  /** Stringify the SSR result of a layout's `render` method. */
  toString: (result: RenderResult) => Promisable<string>
  /** Path to module responsible for hydrating the client. */
  hydrator?: string
}

/**
 * Layout renderers control how a layout is rendered
 * in both server and client environments.
 *
 * This function is excluded from client bundles, because of
 * the `../plugins/clientLayout` module.
 */
export const defineLayoutRenderer = <RenderResult>({
  toString,
  hydrator,
}: LayoutRenderer<RenderResult>) =>
  function <
    ClientProps extends object = any,
    ServerProps extends object = any,
    RouteModule extends object = any
  >(
    config: RouteLayout<ClientProps, ServerProps, RouteModule, RenderResult>
  ): RouteLayout<ClientProps, ServerProps, RouteModule, string> {
    config.file ||= getCurrentModule()
    config.hydrator ||= hydrator

    const { render } = config
    config.render = async req => {
      const rendered = await render(req)
      return toString(rendered) as any
    }

    return config as any
  }
