import path from 'path'
import { addDeployHook, addDeployTarget, getDeployContext } from 'saus/core'
import { Props } from './types'

const hook = addDeployHook(() => import('./hook'))

export function pushVercelFunctions(options: Props) {
  const { root } = getDeployContext()
  const functionDir = path.resolve(root, options.functionDir)
  return addDeployTarget(hook, {
    gitBranch: options.gitBranch,
    functionDir: path.relative(root, functionDir),
    entries: options.entries,
    minify: options.minify,
  })
}
