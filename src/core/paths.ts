import fs from 'fs'
import path from 'path'

declare const __DIST__: string

export const sausRootDir = __DIST__
export const bundleDir = toSausPath('bundle/runtime')
export const clientDir = toSausPath('client')
export const coreDir = toSausPath('core')
export const globalCachePath = toSausPath('core/cache.mjs')
export const httpDir = toSausPath('runtime/http')
export const runtimeDir = toSausPath('runtime')
export const secretsDir = toSausPath('secrets')
export const utilsDir = toSausPath('utils')

export function toSausPath(file: string) {
  return fs.realpathSync(path.join(sausRootDir, file))
}

const sausRootPathRE = getFilePathRegex([
  sausRootDir,
  clientDir,
  runtimeDir,
  utilsDir,
])

/**
 * Returns true if the file belongs to one of the following packages:
 *   - `saus`
 *   - `@saus/client`
 *   - `@saus/runtime`
 *   - `@saus/utils`
 */
export function isSausPath(file: string) {
  return sausRootPathRE.test(file)
}

function getFilePathRegex(paths: string[]) {
  const commonPath = findCommonAncestor(paths)
  return new RegExp(
    `^${commonPath}/${paths.map(p => path.relative(commonPath, p)).join('|')}/`
  )
}

function findCommonAncestor(paths: string[]) {
  let result = paths[0]
  for (let i = 1; i < paths.length; i++) {
    let rel = path.relative(result, paths[i])
    rel = rel.slice(0, rel.lastIndexOf('../') + 2)
    result = path.resolve(result, rel)
  }
  return result
}
