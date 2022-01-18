import Worker from 'tinypool'
import vm from 'vm'
import { SourceMap, toInlineSourceMap } from '../bundle/sourceMap'
import type { RenderedPage } from '../bundle/types'
import { resolveStackTrace } from '../utils/resolveStackTrace'

export interface BuildWorker extends Worker {
  /** Render a page by its URL. */
  run(pageUrl: string): Promise<RenderedPage | null>
}

const { code, map } = Worker.workerData as { code: string; map: SourceMap }

const onError = (error: any) => {
  error.stack = resolveStackTrace(error.stack, code, map)
  throw error
}

const catchRenderExceptions =
  (renderPage: (arg: any) => Promise<any>) => async (arg: any) => {
    try {
      const page = await renderPage(arg)
      return page
    } catch (error: any) {
      onError(error)
    }
  }

const bundle: any = {}
try {
  const initialize: (exports: any, require: Function) => void =
    vm.runInThisContext(
      '(0, function(exports,require) {' +
        code +
        '\n})' +
        toInlineSourceMap(map),
      { filename: 'bundle.js' }
    )

  initialize(bundle, require)
} catch (error: any) {
  onError(error)
}

export default catchRenderExceptions(bundle.default)
