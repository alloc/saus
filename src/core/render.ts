import { ClientProvider } from './client'
import { RenderRequest, Renderer } from './renderer'
import { renderModule } from './global'
import { ConfigHook } from './context'
import { RegexParam } from './routes'

type Promisable<T> = T | PromiseLike<T>
type ExcludeVoid<T> = Exclude<T, null | void>

/**
 * Values that can be configured by the "render module"
 * defined in `saus.yaml` with the `render` path property.
 */
export type RenderModule = {
  /** Hooks that run before the renderer */
  beforeRenderHooks: BeforeRenderHook[]
  /** The renderers for specific routes */
  renderers: Renderer<string | null | void>[]
  /** The renderer used when no route is matched */
  defaultRenderer?: Renderer<string>
  /** Functions that modify the Vite config */
  configHooks: ConfigHook[]
}

export type BeforeRenderHook = {
  (request: RenderRequest<any, any>): Promisable<void>
  test?: (path: string) => boolean
  hash?: string
  start?: number
}

export type RenderHook<T = any> = (
  module: any,
  request: RenderRequest<any, any>
) => Promisable<T>

type ToString<T> = (result: T) => Promisable<string>

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
        let html = await stringifyBody(result)
        if (!/^\s*<body( |>)/.test(html)) {
          html = `<body>\n${html}\n</body>`
        }
        if (getHead) {
          let head = await stringifyHead(await getHead(req))
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

/** Run a before-render effect for every route */
export function beforeRender(hook: BeforeRenderHook): void

/** Run a before-render effect for the given `route` */
export function beforeRender(route: string, hook: BeforeRenderHook): void

export function beforeRender(...args: any[]) {
  let hook: BeforeRenderHook
  if (typeof args[0] == 'string') {
    const route = args[0]
    hook = args[1]
    const regex = RegexParam.parse(route).pattern
    hook.test = regex.test.bind(regex)
  } else {
    hook = args[0]
  }
  if (args.length > 2) {
    const [hash, start] = args.slice(-2)
    hook.hash = hash
    hook.start = start
  }
  renderModule.beforeRenderHooks.push(hook)
}
