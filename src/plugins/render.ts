import * as vite from 'vite'
import { babel } from '../babel'
import {
  ClientState,
  Context,
  Renderer,
  RouteConfig,
  RouteModule,
  RouteParams,
} from '../context'
import { matchRoute } from '../routes'
import { injectRenderMetadata } from '../transform'
import { Plugin } from '../vite'

export function renderPlugin(context: Context): Plugin {
  let reversedRoutes: RouteConfig[]
  let renderers: Renderer<string>[]

  return {
    name: 'saus:render',
    enforce: 'pre',
    contextUpdate(context) {
      reversedRoutes = [...context.routes].reverse()
      renderers = [...context.renderers].reverse()
    },
    transform(code, id) {
      if (id === context.renderPath) {
        return babel.transformSync(code, {
          plugins: [
            ['@babel/syntax-typescript', { isTSX: /\.[tj]sx$/.test(id) }],
            { visitor: { Program: injectRenderMetadata } },
          ],
          filename: id,
          sourceMaps: true,
        }) as vite.TransformResult
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!reversedRoutes) return next()
        const path = req.url!

        let routeParams: RouteParams | undefined
        const route = reversedRoutes.find(
          route => (routeParams = matchRoute(path, route))
        )

        let error: any
        if (route && routeParams) {
          try {
            for (const renderer of renderers) {
              if (!renderer.test(path)) continue
              if (await render(renderer, route.import, routeParams)) {
                return // Response was sent.
              }
            }
          } catch (e: any) {
            error = e
          }
        }

        // Skip requests with file extension, unless explicitly
        // handled by a routed renderer.
        if (!error && /\.[^/]+$/.test(path)) {
          return next()
        }

        // Render the fallback page.
        if (context.defaultRenderer && context.defaultRoute) {
          const { defaultRenderer, defaultRoute } = context
          await render(defaultRenderer, defaultRoute, { error })
        } else {
          next(error)
        }

        async function render(
          renderer: Renderer<string>,
          getRouteModule: () => Promise<RouteModule>,
          routeParams: RouteParams
        ) {
          const { render, getClient, didRender } = renderer
          if (!getClient) {
            throw Error(`Page cannot be hydrated without a client`)
          }

          const routeModule = await getRouteModule()
          const state: ClientState = {
            routeModuleId: parseDynamicImport(getRouteModule),
            routeParams,
          }

          let html = await render(routeModule, routeParams, {
            didRender,
            state,
          })
          if (html == null) {
            return false
          }

          context.clients[path] = await getClient(state, renderer, context)
          html = await server.transformIndexHtml(path, html, req.originalUrl)

          res.writeHead(200)
          res.write(html)
          res.end()

          return true
        }
      })
    },
  }
}

const importRE = /\b__vite_ssr_dynamic_import__\(["']([^"']+)["']\)/

function parseDynamicImport(fn: Function) {
  return importRE.exec(fn.toString())![1]
}
