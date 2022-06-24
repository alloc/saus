import { getDeployContext } from '../../deploy/context'

/**
 * ⚠︎ Never call this function manually!
 */
export function checkSecrets(importedValues: any[]) {
  const { secrets } = getDeployContext()
  for (const value of importedValues) {
    if (typeof value == 'function') {
      secrets['_imported'].add(value)
    }
  }
}
