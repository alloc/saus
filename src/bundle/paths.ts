import { generateRoutePaths } from '../core/routes'
import { getPagePath } from '../utils/getPagePath'
import config from './config'
import { ssrRoutesId } from './constants'
import { context } from './context'
import { ssrRequire } from './ssrModules'

const { logger } = context
const debugBase =
  config.debugBase && config.base.replace(/\/$/, config.debugBase)

export async function getKnownPaths(options: { noDebug?: boolean } = {}) {
  const paths: string[] = []
  const errors: { reason: string; path: string }[] = []

  await ssrRequire(ssrRoutesId)
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
