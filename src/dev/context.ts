import type { App, RenderedFile } from '@/app/types'
import type { BaseContext } from '@/context'
import type { ParsedUrl } from '@/node/url'
import type { Promisable } from '@/utils/types'
import type { vite } from '@/vite'
import type { RequireAsyncState } from '@/vm/asyncRequire'
import type { RequireAsync } from '@/vm/types'
import { Merge } from 'type-fest'
import type { DevEventEmitter } from './events'
import type { HotReloadFn } from './hotReload'

export interface DevContext extends Merge<BaseContext, DevState & DevMethods> {
  command: 'serve'
}

type PageSetupHook = (url: ParsedUrl) => Promisable<void>

export interface DevState extends Required<RequireAsyncState> {
  app: App
  events: DevEventEmitter
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
  ssrRequire: RequireAsync
  ssrForceReload?: (id: string) => boolean
}
