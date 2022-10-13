import { getPageFilename } from '@utils/getPageFilename'
import { PurgeOptions, PurgeRequest } from './types'

export function makePurgeRequest(
  trigger: PurgeRequest['trigger'],
  options: PurgeOptions
) {
  const request: PurgeRequest = {
    trigger,
    files: new Set(options.files),
    paths: new Set(),
    globs: new Set(),
  }
  if (options.pages) {
    for (const path of options.pages) {
      if (path.includes('*')) {
        request.globs.add(path)
      } else {
        request.paths.add(path)
        if (!/\.[^.]+$/.test(path)) {
          const filename = getPageFilename(path)
          request.files.add(filename)
          request.files.add(filename + '.js')
        }
      }
    }
  }
  return request
}
