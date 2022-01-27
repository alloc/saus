import { HtmlVisitor } from './types'
import { bindVisitors } from './visitors/bind'

/** Used for testing purposes */
export function traverse(html: string, visitors: HtmlVisitor | HtmlVisitor[]) {
  return bindVisitors(visitors)(html, {
    page: {
      path: '/',
      html,
      files: [],
      state: { routePath: '/', routeParams: {} },
      stateModules: [],
      routeModuleId: '/main.js',
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
