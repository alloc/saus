import { ProfiledEventHandler } from '@/app/types'
import { loadResponseCache, responseCache } from '@/http/responseCache'
import { makeRequestUrl } from '@/makeRequest'
import { loadSourceMap, SourceMap } from '@/node/sourceMap'
import { resolveStackTrace } from '@/node/stack'
import { parseUrl } from '@/node/url'
import { MutableRuntimeConfig } from '@/runtime/config'
import { isMainThread, MessagePort } from 'worker_threads'
import type { PageBundle, PageBundleOptions } from '../bundle/types'
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
  const { root, eventPort, runtimeConfig, isProfiling } = bundle

  const {
    default: createApp,
    configureBundle,
    setResponseCache,
  } = runBundle(bundle)

  const init = createApp()
  const events = new Multicast<PageEvents>(eventPort)

  let profile: ProfiledEventHandler | undefined
  if (isProfiling)
    profile = (...args) => {
      events.emit('profile', ...args)
    }

  configureBundle({
    ...runtimeConfig,
    profile,
    postProcessAsset(data) {
      // When `data` is a Node buffer, we cannot be sure if it can
      // be safely copied between threads, since it may have been
      // allocated with `Buffer.from` (which uses object pooling).
      // An explicit copy into a non-pooled buffer is the only
      // way to make sure the data won't get corrupted.
      if (!isMainThread && Buffer.isBuffer(data)) {
        const nonPooled = Buffer.alloc(data.byteLength)
        data.copy(nonPooled)
        data = nonPooled.buffer
      }
      return data
    },
  })

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
