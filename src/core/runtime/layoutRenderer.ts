import { Promisable } from 'type-fest'
import { RouteLayout } from './layouts'

export interface LayoutRenderer<RenderResult = any> {
  /** Stringify the SSR result of a layout's `render` method. */
  toString: (result: RenderResult) => Promisable<string>
  /** Path to module responsible for hydrating the client. */
  hydrator?: string
}

/**
 * Layout renderers control how a layout is rendered
 * in both server and client environments.
 */
export const defineLayoutRenderer = <RenderResult>({
  toString,
  hydrator,
}: LayoutRenderer<RenderResult>) =>
  function defineLayout<
    ClientProps extends object = Record<string, any>,
    ServerProps extends object = Record<string, any>
  >(
    layout: Omit<RouteLayout<ClientProps, ServerProps, RenderResult>, 'file'>
  ): RouteLayout<ClientProps, ServerProps, string> {
    const { render } = layout
    layout.render = async req => {
      const rendered = await render(req)
      return toString(rendered) as any
    }
    layout.hydrator ||= hydrator
    return layout as any
  }
