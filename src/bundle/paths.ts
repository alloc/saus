import { generateRoutePaths } from '../core/routes'
import { getPagePath } from '../utils/getPagePath'
import config from './config'
import { context } from './context'
import { ssrImport } from './ssrModules'

const { logger } = context

export async function getKnownPaths(options: { noDebug?: boolean } = {}) {
  const paths: string[] = []
  const errors: { reason: string; path: string }[] = []
  const debugBase = context.debugBasePath

  await ssrImport(config.ssrRoutesId)
  await generateRoutePaths(context, {
    path(path, params) {
      const pageId = getPagePath(path, params).slice(1)
      paths.push(config.base + pageId)
      if (debugBase && !options.noDebug) {
        paths.push(debugBase + pageId)
      }
    },
    error(e) {
      errors.push(e)
    },
  })

  if (errors.length) {
    logger.error(``)
    for (const error of errors) {
      logger.error(`Failed to render ${error.path}`)
      logger.error(`  ${error.reason}`)
      logger.error(``)
    }
  }

  return paths
}
