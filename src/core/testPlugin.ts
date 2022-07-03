import { Plugin } from './vite'

export interface TestPlugin {
  /** Dev server plugins */
  plugins?: Plugin[]
  /** A file was changed. */
  onFileChange?: () => void
  /** The dev server was restarted. */
  onRestart?: () => void
}

export function defineTestPlugin(testPlugin: TestPlugin) {
  return testPlugin
}
