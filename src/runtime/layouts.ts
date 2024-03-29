import { AnyToObject } from '@utils/types'
import { Promisable } from 'type-fest'
import { ClientHooks } from './clientHooks'
import { UnsafeHTML } from './html/template'
import { defineLayoutRenderer } from './layoutRenderer'
import { RenderRequest } from './renderer'

export type HeadDescription = string | UnsafeHTML

export interface RouteLayout<
  ClientProps extends object = any,
  ServerProps extends object = any,
  RouteModule extends object = any,
  RenderResult = any
> {
  /** Generate `<head>` HTML for a given request */
  head?: (
    req: RenderRequest<
      AnyToObject<ClientProps> & AnyToObject<ServerProps>,
      RouteModule
    >
  ) => Promisable<HeadDescription>
  /**
   * Generate `<body>` HTML for a given request.
   *
   * All statements must be isomorphic!
   */
  render: (
    req: RenderRequest<ClientProps, RouteModule>
  ) => Promisable<RenderResult>
  /** Event hooks for the client. */
  clientHooks?: ClientHooks
  /** Path to hydration module. Usually defined by renderer. */
  hydrator?: string
  /** Path to `defineLayout` caller */
  file?: string
}

/**
 * Define a plain HTML layout constructor.
 *
 * You should `export default` the returned object.
 */
export const defineLayout = defineLayoutRenderer({
  toString: (html: string) => html,
})
