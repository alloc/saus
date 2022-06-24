import { vite } from '..'
import { SourceMap } from '../node/sourceMap'
import { Script } from './types'

export function overwriteScript(
  filename: string,
  oldScript: Script,
  newScript: { code: string; map?: any }
): Script {
  let map: SourceMap | undefined
  if (oldScript.map && newScript.map) {
    map = vite.combineSourcemaps(filename, [
      newScript.map,
      oldScript.map as any,
    ]) as any
  } else {
    map = newScript.map || oldScript.map
  }
  return {
    code: newScript.code,
    map,
  }
}
