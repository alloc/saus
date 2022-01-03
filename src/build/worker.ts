import Worker from 'tinypool'
import vm from 'vm'
import { workerData } from 'worker_threads'
import type { RenderedPage } from '../bundle/types'

export interface BuildWorker extends Worker {
  /** Render a page by its URL. */
  run(pageUrl: string): Promise<RenderedPage | null>
}

const initialize: (exports: any, require: Function) => void =
  vm.runInThisContext('(0, function(exports,require) {' + workerData + '\n})')

const bundle: any = {}
initialize(bundle, require)

export default bundle.default
