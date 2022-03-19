import { workerData } from 'worker_threads'
import { runBundle } from './runBundle'

export interface BuildWorker {
  renderPage(pageUrl: string): void
  destroy?: () => Promise<void>
}

export default runBundle(workerData)
