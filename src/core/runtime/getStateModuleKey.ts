import { murmurHash } from '@utils/murmur3'
import { sortObjects } from '@utils/sortObjects'
import { StateModule } from './stateModules'

export function getStateModuleKey(module: StateModule<any, []>): string

export function getStateModuleKey<Args extends readonly any[]>(
  module: StateModule<any, Args>,
  args: Args
): string

export function getStateModuleKey(
  moduleId: StateModule | string,
  args: readonly any[] | string
): string

export function getStateModuleKey(
  module: string | StateModule,
  args?: string | readonly any[]
): string {
  let cacheKey: string
  if (typeof module == 'string') {
    cacheKey = module
  } else if (args) {
    cacheKey = module.name
  } else {
    return module.key
  }
  if (typeof args !== 'string') {
    args = JSON.stringify(args, sortObjects)
  }
  if (args !== '[]') {
    cacheKey += '.' + murmurHash(args)
  }
  return cacheKey
}
