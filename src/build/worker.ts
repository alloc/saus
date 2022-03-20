import { workerData } from 'worker_threads'
import { loadPageFactory } from './pageFactory'

export interface BuildWorker {
  renderPage(pageUrl: string): void
  destroy?: () => Promise<void>
}

export default loadPageFactory(workerData)
