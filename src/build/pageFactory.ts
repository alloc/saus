import { MessagePort } from 'worker_threads'
import { ProfiledEventHandler } from '../app/types'
import { PageBundle, PageBundleOptions } from '../bundle/types'
import { loadSourceMap, MutableRuntimeConfig, SourceMap } from '../core'
import { makeRequestUrl } from '../core/makeRequest'
import { loadResponseCache, responseCache } from '../http/responseCache'
import { resolveStackTrace } from '../utils/stack'
import { parseUrl } from '../utils/url'
import { Multicast } from './multicast'
import { runBundle } from './runBundle'

export interface BundleDescriptor {
  root: string
  code: string
  map?: SourceMap
  filename: string
  eventPort: MessagePort
  runtimeConfig?: Partial<MutableRuntimeConfig>
  isProfiling?: boolean
}

export function loadPageFactory(bundle: BundleDescriptor) {
  const { root, eventPort, runtimeConfig = {}, isProfiling } = bundle

  const {
    default: createApp,
    configureBundle,
    setResponseCache,
  } = runBundle(bundle)

  const init = createApp()
  const events = new Multicast<PageEvents>(eventPort)

  if (isProfiling) {
    runtimeConfig.profile = (...args) => {
      events.emit('profile', ...args)
    }
  }

  if (runtimeConfig) {
    configureBundle(runtimeConfig)
  }

  // If a response cache already exists, the bundle will use it.
  setResponseCache(responseCache || loadResponseCache(root))

  const emitRenderError = (pagePath: string, { message, stack }: any) => {
    const bundleMap =
      'map' in bundle
        ? bundle.map
        : (bundle.map = loadSourceMap(bundle.code, bundle.filename))

    if (bundleMap)
      stack = resolveStackTrace(stack, source => {
        return source == bundle.filename ? bundleMap : null
      })

    events.emit('error', pagePath, stack)
    if (isProfiling)
      events.emit('profile', 'error', {
        url: pagePath,
        message,
        stack,
      })
  }

  const renderOptions: PageBundleOptions = {
    onError(error) {
      // By default, errors are logged and null is returned,
      // but we want to send them back to the main thread instead.
      emitRenderError(error.url, error)
      return null
    },
  }

  return (pagePath: string): void =>
    void init.then(app => {
      const url = parseUrl(pagePath)
      const [, route] = app.resolveRoute(makeRequestUrl(url, 'GET'))
      if (!route) {
        return
      }
      app.renderPageBundle(url, route, renderOptions).then(
        page => {
          events.emit('page', pagePath, page)
        },
        error => {
          emitRenderError(pagePath, error)
        }
      )
    })
}

export type PageEvents = {
  page(pagePath: string, page: PageBundle | null): void
  error(pagePath: string, error: any): void
  profile: ProfiledEventHandler
}
