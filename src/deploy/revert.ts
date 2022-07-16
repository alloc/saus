import { getDeployContext } from './context'
import { RevertFn } from './types'

export function onRevert(revertFn: RevertFn) {
  const ctx = getDeployContext()
  ctx?.revertFns.push(revertFn)
}
