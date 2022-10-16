import { BuildOptions } from '@/core'
import { AbortController } from '@utils/AbortController'
import { onShortcut } from '@utils/node/shortcuts'
import { resolveModules } from '@utils/resolveModules'
import arrify from 'arrify'
import { addExitCallback } from 'catch-exit'
import { cyan, gray, red } from 'kleur/colors'
import { success } from 'misty'
import { startTask } from 'misty/task'
import log from 'shared-log'
import { command } from '../command'

command(build, '[cacheDir]')
  .option('-w, --maxWorkers [count]', `[number] set to zero to disable workers`)
  .option('--force', `[boolean] rebundle instead of using cached bundle`)
  .option('--debug', `[boolean] rebuild pages that failed the last run`)
  .option('--filter <glob>', `[string] control which pages are rendered`)
  .option('--minify', `[boolean] minify the client modules`)
  .option(
    '--mode <mode>',
    `[string] override the client mode (eg: development)`
  )
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`
  )

export type BuildFlags = BuildOptions & {
  debug?: boolean
  filter?: string | string[]
}

export async function build(cacheDir: string | undefined, options: BuildFlags) {
  const [{ build }, { getFailedPages, setFailedPages }] = await resolveModules(
    import('../../build/api.js'),
    import('../../build/failedPages.js')
  )

  if (process.stdin.isTTY) {
    const ctrl = new AbortController()
    options.abortSignal = ctrl.signal

    ctrl.signal.onabort = () => {
      // Exit the process if pressing Enter before rendering starts.
      process.exit()
    }

    const shortcutFooter = startTask(
      gray('» ') + `Press ${cyan('Enter')} to stop rendering and print errors.`,
      { footer: true, elapsed: false }
    )
    addExitCallback(() => {
      shortcutFooter.finish()
    })

    onShortcut(process.stdin, (key, resume) => {
      if (key == '\x03') {
        process.exit()
      } else if (key == '\r') {
        ctrl.abort()
      } else {
        resume()
      }
    })
  }

  options.cacheDir = cacheDir
  if (options.debug) {
    const failedPages = getFailedPages()
    options.skip = pagePath => !failedPages.includes(pagePath)
  } else if (options.filter) {
    const filters = arrify(options.filter).map(
      pattern => new RegExp('^' + pattern + '$')
    )
    options.skip = pagePath => !filters.some(filter => filter.test(pagePath))
  }

  const { pages, errors } = await build(options)
  const failedPages: string[] = []
  if (errors.length) {
    log('')
    for (const error of errors) {
      failedPages.push(error.path)
      log.error(red(`Failed to render`), error.path)
      log.error(`  ` + gray(error.reason))
      log('')
    }
  }
  setFailedPages(failedPages)
  success(`${pages.length} pages rendered.`)
  process.exit(errors.length ? 1 : 0)
}
