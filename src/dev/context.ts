import type { BaseContext } from '@/context'
import type { vite } from '@/vite'
import type { RequireAsync } from '@/vm/types'
import type { App, RenderedFile } from '@runtime/app/types'
import type { ParsedUrl } from '@utils/node/url'
import type { Promisable } from '@utils/types'
import { Merge } from 'type-fest'
import type { DevEventEmitter } from './events'
import type { HotReloadFn } from './hotReload'

export interface DevContext extends Merge<BaseContext, DevState & DevMethods> {
  command: 'serve'
  events: DevEventEmitter
}

type PageSetupHook = (url: ParsedUrl) => Promisable<void>

export interface DevState {
  app: App
  server: vite.ViteDevServer
  watcher: vite.FSWatcher
  /** Defines which files in `node_modules` have live exports. */
  liveModulePaths: Set<string>
  /** These hooks are called before each page is rendered. */
  pageSetupHooks: PageSetupHook[]
  /** Files emitted by a renderer are cached here. */
  servedFiles: Record<string, RenderedFile>
}

export interface DevMethods {
  hotReload: HotReloadFn
  require: RequireAsync
  ssrForceReload?: (id: string) => boolean
}
