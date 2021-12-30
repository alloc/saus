import { HtmlVisitor } from './types'
import { bindVisitors } from './visitors'

export function traverse(html: string, visitors: HtmlVisitor | HtmlVisitor[]) {
  return bindVisitors(visitors)(html, {
    page: { path: '/', html, routeModuleId: '/main.js' },
    config: { base: '/', assetsDir: 'assets', mode: 'development' },
  })
}
