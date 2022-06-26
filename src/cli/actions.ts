import { onShortcut } from '@/node/shortcuts'
import { AbortController } from '@/utils/AbortController'
import { vite } from '@/vite'
import arrify from 'arrify'
import { addExitCallback } from 'catch-exit'
import { cyan, gray, red } from 'kleur/colors'
import { success } from 'misty'
import { startTask } from 'misty/task'
import log from 'shared-log'
import type { PreviewOptions } from '../preview/options'
import type { BuildFlags, BundleFlags, DeployFlags } from './types'

export const commandActions = {
  async dev(options: vite.ServerOptions) {
    const { createServer } =
      require('../dev/api') as typeof import('../dev/api')
    await run(createServer, { server: options })
  },
  async build(cacheDir: string | undefined, options: BuildFlags) {
    const { build } = require('../build/api') as typeof import('../build/api')
    const { getFailedPages, setFailedPages } =
      require('../build/failedPages') as typeof import('../build/failedPages')

    if (process.stdin.isTTY) {
      const ctrl = new AbortController()
      options.abortSignal = ctrl.signal

      ctrl.signal.onabort = () => {
        // Exit the process if pressing Enter before rendering starts.
        process.exit()
      }

      const shortcutFooter = startTask(
        gray('» ') +
          `Press ${cyan('Enter')} to stop rendering and print errors.`,
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

    await run(async () => {
      if (options.debug) {
        const failedPages = getFailedPages()
        options.skip = pagePath => !failedPages.includes(pagePath)
      } else if (options.filter) {
        const filters = arrify(options.filter).map(
          pattern => new RegExp('^' + pattern + '$')
        )
        options.skip = pagePath =>
          !filters.some(filter => filter.test(pagePath))
      }
      options.cacheDir = cacheDir
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
    })
  },
  async bundle(outFile: string, options: BundleFlags) {
    options.outFile = outFile

    const noWrite = !process.stdout.isTTY && !process.env.CI
    if (noWrite) {
      options.write = false
    }

    const { bundle } =
      require('../bundle/api') as typeof import('../bundle/api')
    const { loadBundleContext } =
      require('../bundle/context') as typeof import('../bundle/context')

    await run(async () => {
      const context = await loadBundleContext(options, {
        mode: options.mode,
        logLevel: noWrite ? 'silent' : undefined,
        build: { sourcemap: options.sourcemap },
      })
      let { code, map } = await bundle(context, {
        minify: options.minify,
      })
      if (noWrite) {
        if (map) {
          const { toInlineSourceMap } =
            require('../core/node/sourceMap') as typeof import('@/node/sourceMap')

          code += toInlineSourceMap(map)
        }
        process.stdout.write(code)
      }
      // Shamefully force exit since something unknown is keeping us alive.
      process.exit(0)
    })
  },
  async preview(options: PreviewOptions) {
    const { startPreviewServer } =
      require('../preview/api') as typeof import('../preview/api')
    const server = await startPreviewServer(options)
    server.printUrls()
  },
  async 'secrets add'() {
    const { addSecrets } =
      require('../secrets/api') as typeof import('../secrets/api')
    await run(addSecrets)
  },
  async 'secrets rm'(opts: any) {
    const { removeSecrets } =
      require('../secrets/api') as typeof import('../secrets/api')
    await run(removeSecrets, opts)
  },
  async 'secrets ls'() {
    const { listSecrets } =
      require('../secrets/api') as typeof import('../secrets/api')
    await run(listSecrets)
  },
  async deploy(options: DeployFlags) {
    const { deploy } =
      require('../deploy/api') as typeof import('../deploy/api')
    await run(deploy, {
      ...options,
      noCache: !options.cache,
    })
  },
  async test() {
    const { startTestServer } =
      require('../test/api') as typeof import('../test/api')
    await run(startTestServer)
  },
}

async function run<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  ...args: Args
): Promise<Awaited<Result>> {
  try {
    return await fn(...args)
  } catch (e: any) {
    if (e.message.startsWith('[saus]')) {
      console.error('\n' + red('✗') + e.message.slice(6))
      process.exit(1)
    }
    throw e
  }
}
