import { createApp as create } from '../app/createApp'
import type { AppContext } from '../app/types'
import config from './config'
import { context } from './context'
import { defineClientEntry } from './defineClientEntry'
import { createPageFactory } from './pageFactory'
import { ssrImport } from './ssrModules'
import { BundledApp } from './types'

// Allow `ssrImport("saus/client")` outside page rendering.
defineClientEntry()

export async function createApp(
  plugins: BundledApp.Plugin[] = []
): Promise<BundledApp> {
  await ssrImport(config.ssrRoutesId)

  return create(context, [
    createPageFactory as any,
    createPageEndpoint(context),
    ...plugins,
  ] as any) as any
}

function createPageEndpoint(context: AppContext): BundledApp.Plugin {
  return app => ({
    getEndpoints: (method, route) =>
      route.moduleId !== null &&
      method == 'GET' &&
      (async req => {
        const page = await app.renderPage(req, route)
        if (page) {
          const headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': '' + Buffer.byteLength(page.html),
          }
          req.respondWith(200, headers, {
            text: page.html,
          })
        }
      }),
  })
}
