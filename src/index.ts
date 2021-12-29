export { render } from './render'
export { route } from './routes'
export { getPageFilename } from './pages'
export { transformHtml, resolveHtmlImports } from './html'
export { defineConfig, beforeRender, Plugin, UserConfig, vite } from './core'

export { htmlEscape as escape } from 'escape-goat'

type BuildFactory = typeof import('./build').build
type ServerFactory = typeof import('./dev').createServer

export const build: BuildFactory = async inlineConfig => {
  const { build } = await import('./build')
  return build(inlineConfig)
}

export const createServer: ServerFactory = async inlineConfig => {
  const { createServer } = await import('./dev')
  return createServer(inlineConfig)
}
