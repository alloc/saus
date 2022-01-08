import { HtmlVisitor } from './types'
import { bindVisitors } from './visitors'

/** Used for testing purposes */
export function traverse(html: string, visitors: HtmlVisitor | HtmlVisitor[]) {
  return bindVisitors(visitors)(html, {
    page: {
      path: '/',
      html,
      routeModuleId: '/main.js',
      stateModules: [],
    },
    config: {
      assetsDir: 'assets',
      base: '/',
      bundleType: 'script',
      command: 'dev',
      defaultPath: '/404',
      minify: false,
      mode: 'development',
      publicDir: 'public',
      stateCacheUrl: '',
    },
  })
}
