import * as vite from 'vite'
import { babel } from '../babel'
import { Context } from '../context'
import { SourceDescription } from '../vite'

export function routesPlugin(context: Context): vite.Plugin {
  return {
    name: 'stite:routes',
    enforce: 'pre',
    async resolveId(id, importer, _, ssr) {
      if (ssr || importer?.endsWith('.html')) return
      const resolved = await this.resolve(id, importer, { skipSelf: true })
      if (resolved?.id === context.routesPath) {
        return clientRoutesId
      }
    },
    load(id) {
      if (id === clientRoutesId) {
        return generateClientRoutes(context)
      }
    },
  }
}

const clientRoutesId = '/@stite/routes'

function generateClientRoutes({ routesPath }: Context) {
  const syntaxPlugins = /\.tsx?$/.test(routesPath)
    ? [['@babel/syntax-typescript', { isTSX: routesPath.endsWith('x') }]]
    : []

  return babel.transformFileSync(routesPath, {
    filename: routesPath,
    plugins: [...syntaxPlugins],
  }) as SourceDescription
}
