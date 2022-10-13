import type { Plugin, UserConfig } from '@/core'
import type { TestPlugin } from '@/testPlugin'
import { unwrapDefault } from '@utils/unwrapDefault'
import { fatal } from 'misty'
import { command } from '../command'

command(startTestServer) //

export { startTestServer as test }

async function startTestServer() {
  let test: TestPlugin

  const mainPlugin: Plugin = {
    name: 'saus:test',
    enforce: 'pre',
    async config(config, env) {
      if (!config.testFramework)
        fatal(
          `Cannot use "saus test" without defining "testFramework" in your Vite config`
        )

      test = unwrapDefault(await config.testFramework(config as UserConfig))
      return {
        plugins: test.plugins,
      }
    },
  }

  const { vite } = await import('../../core/vite.js')
  const { createServer } = await import('../../dev/api.js')

  await createServer({
    plugins: [mainPlugin],
    customLogger: vite.createLogger(undefined, {
      allowClearScreen: false,
    }),
  })
}
