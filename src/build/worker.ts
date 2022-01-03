import Worker from 'tinypool'
import vm from 'vm'
import { workerData } from 'worker_threads'
import type { RenderedPage } from '../bundle/types'

console.log('worker: (pid = %O, ppid = %O)', process.pid, process.ppid)

export interface BuildWorker extends Worker {
  /** Render a page by its URL. */
  run(task: { pageUrl: string }): Promise<RenderedPage | null>
}

const renderPage: (pageUrl: string) => Promise<RenderedPage | null> =
  vm.runInThisContext(workerData)

const run: BuildWorker['run'] = (task): any => {
  return renderPage(task.pageUrl)
}

export default run
