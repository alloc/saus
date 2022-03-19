import path from 'path'
import vm from 'vm'
import { MessagePort } from 'worker_threads'
import { RenderedPage } from '../bundle/types'
import {
  loadSourceMap,
  MutableRuntimeConfig,
  removeSourceMapUrls,
} from '../core'
import { loadResponseCache, responseCache } from '../http/responseCache'
import { ProfiledEvent, ProfiledEventType } from '../pages/types'
import { resolveStackTrace } from '../utils/resolveStackTrace'
import { Multicast } from './multicast'

export interface BundleDescriptor {
  root: string
  code: string
  filename: string
  eventPort: MessagePort
  runtimeConfig?: Partial<MutableRuntimeConfig>
  isProfiling?: boolean
}

export function runBundle(bundle: BundleDescriptor) {
  const {
    root,
    code,
    filename,
    eventPort,
    runtimeConfig = {},
    isProfiling,
  } = bundle

  const initialize: (exports: any, require: Function) => void =
    vm.runInThisContext(
      `(0, function(exports,require) {` +
        removeSourceMapUrls(code) +
        `\n})\n//# sourceMappingURL=${path.basename(filename)}.map\n`,
      { filename }
    )

  const exports: any = {}
  initialize(exports, require)

  const {
    default: renderPage,
    configureBundle,
    setResponseCache,
  } = exports as typeof import('../bundle/main')

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
        const map = loadSourceMap(code, filename)
        if (map) {
          error.stack = resolveStackTrace(error.stack, source => {
            return source == filename ? map : null
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
