import { generateRoutePaths } from '../../core/routes'
import { getPagePath } from '../../utils/getPagePath'
import { ssrRequire } from '../ssrModules'
import { ssrRoutesId } from './constants'
import { context } from './context'

const { logger } = context

export async function getKnownPaths() {
  const paths: string[] = []
  const errors: { reason: string; path: string }[] = []

  await ssrRequire(ssrRoutesId)
  await generateRoutePaths(context, {
    path(path, params) {
      paths.push(getPagePath(path, params))
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
