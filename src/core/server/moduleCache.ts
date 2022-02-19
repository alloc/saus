import { gray } from 'kleur/colors'
import { getModuleUrl } from '../../bundle/getModuleUrl'
import type { ClientModule } from '../../bundle/types'
import type { RuntimeConfig } from '../config'
import { debug } from './debug'

export interface ModuleCache extends Map<string, ClientModule> {
  add(module: ClientModule): void
}

export function createModuleCache(
  base: string,
  init?: readonly ClientModule[]
) {
  const modules = new Map(
    init?.map(module => {
      const url = getModuleUrl(module, base)
      debug(gray('loaded'), url)
      return [url, module] as const
    })
  ) as ModuleCache

  modules.add = module => {
    const url = getModuleUrl(module, base)
    if (!modules.has(url)) {
      debug(gray('loaded'), url)
      modules.set(url, module)
    }
  }

  return modules
}
