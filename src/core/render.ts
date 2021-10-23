import { ClientProvider } from './client'
import { RenderRequest, Renderer } from './renderer'
import { renderModule } from './global'
import { ConfigHook } from './context'

type Promisable<T> = T | PromiseLike<T>
type ExcludeVoid<T> = Exclude<T, null | void>

/**
 * Values that can be configured by the "render module"
 * defined in `saus.yaml` with the `render` path property.
 */
export type RenderModule = {
  /** The renderers for specific routes */
  renderers: Renderer<string | null | void>[]
  /** The renderer used when no route is matched */
  defaultRenderer?: Renderer<string>
  /** Functions that modify the Vite config */
  configHooks: ConfigHook[]
}

export type RenderHook<T = any> = (
  module: any,
  request: RenderRequest<any, any>
) => Promisable<T>

type ToString<T> = (result: T) => string

/**
 * Create a `Renderer` and add it to the current Saus context.
 *
 * To define the fallback renderer, the `route` argument should
 * be an empty string.
 *
 * The `stringify` function should never prepend a doctype.
 */
export function render<T>(
  route: string,
  render: RenderHook<T | null | void>,
  stringify: ToString<T> | { head: ToString<T>; body: ToString<T> },
  getClient?: ClientProvider,
  hash?: string,
  start?: number
): Renderer<ExcludeVoid<T>> {
  const stringifyHead =
    typeof stringify == 'function' ? stringify : stringify.head
  const stringifyBody =
    typeof stringify == 'function' ? stringify : stringify.body
  const renderer = new Renderer(
    route,
    async (mod, req, { getHead, didRender }) => {
      const result = await render(mod, req)
      if (result == null) return
      try {
        let html = stringifyBody(result)
        if (!/^\s*<body( |>)/.test(html)) {
          html = `<body>\n${html}\n</body>`
        }
        if (getHead) {
          let head = stringifyHead(await getHead(req))
          if (!/^\s*<head( |>)/.test(head)) {
            head = `<head>\n${head}\n</head>`
          }
          html = head + html
        }
        if (!/^\s*<html( |>)/.test(html)) {
          html = `<html>${html}</html>`
        }
        return `<!DOCTYPE html>\n` + html
      } finally {
        await didRender()
      }
    },
    getClient,
    hash,
    start
  )
  if (route) {
    renderModule.renderers.push(renderer)
  } else {
    renderModule.defaultRenderer = renderer
  }
  return renderer
}
