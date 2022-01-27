import { ClientModule } from '../types'
import config from './config'

const htmlExtension = '.html'
const indexHtmlSuffix = '/index.html'

export const getModuleUrl = (mod: ClientModule) =>
  config.base +
  (mod.id.endsWith(htmlExtension)
    ? ('/' + mod.id).endsWith(indexHtmlSuffix)
      ? mod.id.slice(0, 1 - indexHtmlSuffix.length)
      : mod.id.slice(0, -htmlExtension.length)
    : mod.id)
