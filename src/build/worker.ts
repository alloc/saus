import Worker from 'tinypool'
import { workerData } from 'worker_threads'
import type { RenderedPage } from '../bundle/types'
import { runBundle } from './runBundle'

export interface BuildWorker extends Worker {
  /** Render a page by its URL. */
  run(pageUrl: string): Promise<RenderedPage | null>
}

export default runBundle(workerData)
