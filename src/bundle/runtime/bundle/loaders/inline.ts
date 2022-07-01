import config from '../config'
import inlinedAssets from '../inlinedAssets'
import inlinedModules from '../inlinedModules'

const debugBase = config.debugBase?.slice(1)

export async function loadModule(id: string) {
  let isDebug: boolean | undefined
  if (debugBase && id.startsWith(debugBase)) {
    isDebug = true
    id = id.replace(debugBase, '')
  }
  const module = inlinedModules[id]
  return (isDebug && module.debugText) || module.text
}

export async function loadAsset(id: string): Promise<Buffer> {
  return Buffer.from(inlinedAssets[id], 'base64')
}
