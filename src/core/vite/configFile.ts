import { SausCommand } from '../context'
import { vite } from '../vite'
import { getConfigEnv } from './config'

export const loadConfigFile = (
  command: SausCommand,
  configFile?: string,
  inlineConfig: vite.InlineConfig = {}
) =>
  vite.loadConfigFromFile(
    getConfigEnv(command, inlineConfig.mode),
    configFile,
    inlineConfig.root,
    inlineConfig.logLevel
  )
