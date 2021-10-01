import * as vite from 'vite'
import { Project } from 'ts-morph'
import { Context } from '../context'

export function routesPlugin(context: Context): vite.Plugin {
  return {
    name: 'stite:routes',
    async resolveId(id, importer) {
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

function generateClientRoutes(context: Context) {
  const project = new Project()
  const routesModule = project.addSourceFileAtPath(context.routesPath)
  return ''
}
