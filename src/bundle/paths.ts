import { generateRoutePaths } from '../core/routes'
import { getPagePath } from '../utils/getPagePath'
import config from './config'
import { context } from './context'
import { ssrImport } from './ssrModules'

const { onError } = context
const debugBase =
  config.debugBase && config.base.replace(/\/$/, config.debugBase)

export async function getKnownPaths(options: { noDebug?: boolean } = {}) {
  await ssrImport(config.ssrRoutesId)
  const loaded = {
    routes: context.routes,
    defaultRoute: context.defaultRoute,
    defaultPath: context.config.defaultPath,
  }

  const paths: string[] = []
  await generateRoutePaths(loaded, {
    path(path, params) {
      const pageId = getPagePath(path, params).slice(1)
      paths.push(config.base + pageId)
      if (debugBase && !options.noDebug) {
        paths.push(debugBase + pageId)
      }
    },
    error(e) {
      onError(Error(`Found issue with "${e.path}" route: ` + e.reason))
    },
  })

  return paths
}
