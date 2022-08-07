import { md5Hex } from '../utils/md5-hex'
import { sortObjects } from '../utils/sortObjects'
import { StateModule } from './stateModules'

export function getStateModuleKey<Args extends readonly any[]>(
  module: StateModule<any, Args>,
  args: Args
): string {
  let cacheKey = module.id
  if (args.length && !module.parent) {
    const hash = md5Hex(JSON.stringify(args, sortObjects))
    cacheKey += '.' + hash.slice(0, 8)
  }
  return cacheKey
}
