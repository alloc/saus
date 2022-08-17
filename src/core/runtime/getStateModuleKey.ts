import { md5Hex } from '../utils/md5-hex'
import { sortObjects } from '../utils/sortObjects'
import { StateModule } from './stateModules'

export function getStateModuleKey(module: StateModule<any, []>): string

export function getStateModuleKey<Args extends readonly any[]>(
  module: StateModule<any, Args>,
  args: Args
): string

export function getStateModuleKey(
  moduleId: string,
  args: readonly any[]
): string

export function getStateModuleKey(
  module: string | StateModule,
  args: readonly any[] = (module as StateModule).args!
): string {
  let cacheKey: string
  if (typeof module == 'string') {
    cacheKey = module
  } else {
    cacheKey = module.id
    if (module.parent) {
      return cacheKey
    }
  }
  if (args.length) {
    const hash = md5Hex(JSON.stringify(args, sortObjects))
    cacheKey += '.' + hash.slice(0, 8)
  }
  return cacheKey
}
