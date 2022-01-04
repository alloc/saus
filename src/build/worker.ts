import Worker from 'tinypool'
import vm from 'vm'
import { workerData } from 'worker_threads'
import { SourceMap, toInlineSourceMap } from '../bundle/sourceMap'
import type { RenderedPage } from '../bundle/types'

export interface BuildWorker extends Worker {
  /** Render a page by its URL. */
  run(pageUrl: string): Promise<RenderedPage | null>
}

const { code, map } = workerData as { code: string; map: SourceMap }

const initialize: (exports: any, require: Function) => void =
  vm.runInThisContext(
    '(0, function(exports,require) {' + code + '\n})' + toInlineSourceMap(map)
  )

const bundle: any = {}
initialize(bundle, require)
export default bundle.default
