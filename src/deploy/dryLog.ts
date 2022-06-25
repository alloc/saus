import { noop } from '@/utils/noop'
import { cyan } from 'kleur/colors'
import { getDeployContext } from './context'

export function createDryLog(logPrefix: string) {
  const { dryRun, logger } = getDeployContext()
  if (dryRun) {
    logPrefix = '💧 ' + cyan(logPrefix) + ' '
    return (msg: string) => logger.info(logPrefix + msg)
  }
  return noop
}
