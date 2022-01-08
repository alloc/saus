import { generateRoutePaths, RegexParam } from '../../core/routes'
import { context } from './context'

const { logger } = context

export default async function getKnownPaths() {
  const paths: string[] = []
  const errors: { reason: string; path: string }[] = []

  await generateRoutePaths(context, {
    path(path, params) {
      paths.push(params ? RegexParam.inject(path, params) : path)
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
