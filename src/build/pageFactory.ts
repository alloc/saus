import { MessagePort } from 'worker_threads'
import { RenderedPage } from '../bundle/types'
import { loadSourceMap, MutableRuntimeConfig } from '../core'
import { loadResponseCache, responseCache } from '../http/responseCache'
import { ProfiledEvent, ProfiledEventType } from '../pages/types'
import { resolveStackTrace } from '../utils/resolveStackTrace'
import { Multicast } from './multicast'
import { runBundle } from './runBundle'

export interface BundleDescriptor {
  root: string
  code: string
  filename: string
  eventPort: MessagePort
  runtimeConfig?: Partial<MutableRuntimeConfig>
  isProfiling?: boolean
}

export function loadPageFactory(bundle: BundleDescriptor) {
  const { root, eventPort, runtimeConfig = {}, isProfiling } = bundle

  const {
    default: renderPage,
    configureBundle,
    setResponseCache,
  } = runBundle(bundle)

  const events = new Multicast<PageEvents>(eventPort)

  if (isProfiling)
    runtimeConfig.profile = (type, event) => {
      event.url = event.url.toString() as any
      events.emit('profile', type, event)
    }

  if (runtimeConfig) {
    configureBundle(runtimeConfig)
  }

  // If a response cache already exists, the bundle will use it.
  setResponseCache(responseCache || loadResponseCache(root))

  return (pagePath: string): void =>
    void renderPage(pagePath).then(
      page => {
        events.emit('page', pagePath, page)
      },
      error => {
        const map = loadSourceMap(bundle.code, bundle.filename)
        if (map) {
          error.stack = resolveStackTrace(error.stack, source => {
            return source == bundle.filename ? map : null
          })
        }
        events.emit('error', pagePath, error)
      }
    )
}

export type PageEvents = {
  page(pagePath: string, page: RenderedPage | null): void
  error(pagePath: string, error: any): void
  profile(type: ProfiledEventType, event: ProfiledEvent): void
}
