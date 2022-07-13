import { crawl } from 'recrawl'
import { Plugin } from 'saus'
import { endent, ImportDescriptorMap } from 'saus/core'
import { Promisable } from 'type-fest'
import { uid } from 'uid'

interface Config {
  /**
   * All files matching at least one pattern are loaded,
   * unless matched by a `skip` pattern.
   */
  only: string[]
  /**
   * Skip certain files.
   */
  skip?: string[]
  /**
   * Render a `route` call for the given file. You can also do anything
   * else that's legal in the routes module.
   *
   * The `route` function is imported for you automatically, but
   * not anything else.
   */
  renderRoute: (
    file: string
  ) => Promisable<{ code: string; imports?: ImportDescriptorMap }>
}

export function routesFromFiles(config: Config): Plugin {
  const configId = uid()
  return {
    name: 'route-fs',
    saus({ root, watcher: viteWatcher }) {
      return {
        async injectModules({ command, ssr, prependModule }) {
          if (!ssr) return

          if (command == 'serve') {
            const { filespy } = await import('filespy')
            const watcher = filespy(root, {
              only: config.only,
              skip: config.skip,
            })

            // Wait for initial crawl.
            await new Promise<void>(onReady => watcher.on('ready', onReady))
          } else {
            await crawl(root, {
              only: config.only,
              skip: config.skip,
            })
          }

          prependModule({
            id: `@saus/next/routes/${configId}.js`,
            code: endent`
              
            `,
          })
        },
      }
    },
  }
}
