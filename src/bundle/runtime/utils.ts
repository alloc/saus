import { ClientModule } from '../types'
import config from './config'

const htmlExtension = '.html'
const indexHtmlSuffix = '/index.html'

export const getModuleUrl = (mod: ClientModule) =>
  config.base +
  (mod.id.endsWith(htmlExtension)
    ? mod.id.endsWith(indexHtmlSuffix)
      ? mod.id.slice(0, -indexHtmlSuffix.length)
      : mod.id.slice(0, -htmlExtension.length)
    : mod.id)

const cssLangs = `\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)`
const cssLangRE = new RegExp(cssLangs)

export const isCSSRequest = (request: string): boolean =>
  cssLangRE.test(request)
