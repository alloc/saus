import { getViteFunctions } from '@/vite/functions'
import { serializeImports } from '@runtime/imports'
import { createPluginContainer } from 'vite'
import { expect, test } from 'vitest'
import { loadTestContext } from '../../test'
import { isolateRoutes } from './isolateRoutes'
import { resolveRouteImports } from './routeImports'

test('isolateRoutes', async () => {
  const ctx = await loadTestContext({
    root: '/fixtures/isolateRoutes',
  })

  const ssrEntryId = '\0ssr-entry.js'
  ctx.injectedModules.addServerModule({
    id: ssrEntryId,
    code: serializeImports([ctx.routesPath]).join('\n'),
  })

  const isolatedModules: any = {}
  const routeImports = await resolveRouteImports(ctx)
  const isolatePlugin = await isolateRoutes(
    ctx,
    ssrEntryId,
    routeImports,
    isolatedModules
  )

  expect(Object.keys(isolatedModules)).toMatchInlineSnapshot(`
    [
      "/fixtures/isolateRoutes/_virtual/_ssr-entry.js",
      "/fixtures/isolateRoutes/_virtual/_route.586f75af.js",
      "/fixtures/isolateRoutes/_virtual/_route.6707049e.js",
      "/fixtures/isolateRoutes/routes.js",
    ]
  `)

  const pluginContainer = await createPluginContainer(
    await ctx.resolveConfig({
      plugins: [isolatePlugin],
    })
  )

  const { resolveId, fetchModule } = await getViteFunctions(pluginContainer)

  const fetchedEntries = await Promise.all(
    Object.keys(isolatedModules).map(async id => {
      const resolved = await resolveId(id)
      const loaded = resolved && (await fetchModule(resolved.id))
      expect(loaded || null).not.toBe(null)

      return [id, loaded!] as const
    })
  )

  const concatResult = fetchedEntries.reduce((result, [id, loaded]) => {
    result += '/* ' + id + ' */\n' + loaded.code + '\n\n'
    return result
  }, '')

  const prettier = await import('prettier')
  expect(prettier.format(concatResult, { singleQuote: true, semi: false }))
    .toMatchInlineSnapshot(`
      "/* /fixtures/isolateRoutes/_virtual/_ssr-entry.js */
      import { __d, __requireAsync } from 'saus/core'
      import '/fixtures/isolateRoutes/routes.js'
      __d(' ssr-entry.js', async (__exports) => {
        await __requireAsync('/routes.ts')
      })

      /* /fixtures/isolateRoutes/_virtual/_route.586f75af.js */
      import { __d, __requireAsync } from 'saus/core'
      import '/fixtures/isolateRoutes/src/pages/home.js'
      import '/fixtures/isolateRoutes/src/layouts/default'
      __d(' route.586f75af.js', async (__exports) => {
        const home_js = await __requireAsync('/src/pages/home.js')
        const _default = await __requireAsync('/src/layouts/default')
        __exports.layout = _default.default
        __exports.routeModule = home_js

        const routes = ['/']

        __exports.routes = routes
      })

      /* /fixtures/isolateRoutes/_virtual/_route.6707049e.js */
      import { __d, __requireAsync } from 'saus/core'
      import '/fixtures/isolateRoutes/src/pages/about.js'
      import '/fixtures/isolateRoutes/src/layouts/default'
      __d(' route.6707049e.js', async (__exports) => {
        const about_js = await __requireAsync('/src/pages/about.js')
        const _default = await __requireAsync('/src/layouts/default')
        __exports.layout = _default.default
        __exports.routeModule = about_js

        const routes = ['/about']

        __exports.routes = routes
      })

      /* /fixtures/isolateRoutes/routes.js */
      import { __d, __requireAsync } from 'saus/core'
      import '/fixtures/isolateRoutes/_virtual/_route.6707049e.js'
      import '/fixtures/isolateRoutes/_virtual/_route.586f75af.js'
      import { route } from 'saus'
      __d('/routes.ts', async (__exports) => {
        route('/', {
          entry: () => __requireAsync('/src/pages/home.js'),
        })
        route('/about', {
          entry: () => __requireAsync('/src/pages/about.js'),
        })
      })
      "
    `)
})
