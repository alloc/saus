import { workerData } from 'worker_threads'
import { loadPageFactory } from './pageFactory'

export interface BuildWorker {
  renderPage(pageUrl: string): Promise<void>
  destroy?: () => Promise<void>
}

export default loadPageFactory(workerData)
