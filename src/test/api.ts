import { unwrapDefault } from '@/utils/unwrapDefault'
import { fatal } from 'misty'
import { Plugin, UserConfig, vite } from '../core'
import { createServer } from '../dev/api'

export async function startTestServer() {
  let test: TestFramework

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

  await createServer({
    plugins: [mainPlugin],
    customLogger: vite.createLogger(undefined, {
      allowClearScreen: false,
    }),
  })
}

export interface TestFramework {
  /** Dev server plugins */
  plugins?: Plugin[]
  /** A file was changed. */
  onFileChange?: () => void
  /** The dev server was restarted. */
  onRestart?: () => void
}

export function defineTestFramework(framework: TestFramework) {
  return framework
}
