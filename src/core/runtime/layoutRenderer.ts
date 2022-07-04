import { Promisable } from 'type-fest'
import type { RouteLayout } from './layouts'
import { getCurrentModule } from './ssrModules'

// The first instance of a layout module is reused.
const layouts: { [file: string]: RouteLayout } = {}

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
    config: Omit<
      RouteLayout<ClientProps, ServerProps, RouteModule, RenderResult>,
      'file'
    >
  ): RouteLayout<ClientProps, ServerProps, RouteModule, string> {
    const { render } = config
    config.hydrator ||= hydrator
    config.render = async req => {
      const rendered = await render(req)
      return toString(rendered) as any
    }
    const file: string = ((config as any).file ||= getCurrentModule())
    return config
    // const layout = layouts[file]
    // if (layout) {
    //   return Object.assign(layout, {
    //     clientHooks: undefined,
    //     head: undefined,
    //     hydrator: undefined,
    //     ...config,
    //   })
    // }
    // return (layouts[file] = config as any)
  }
