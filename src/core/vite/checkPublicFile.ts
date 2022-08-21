import { cleanUrl } from '@/utils/cleanUrl'
import { vite } from '@/vite'
import fs from 'fs'
import path from 'path'

export function checkPublicFile(
  url: string,
  { publicDir }: vite.ResolvedConfig
): string | undefined {
  // note if the file is in /public, the resolver would have returned it
  // as-is so it's not going to be a fully resolved path.
  if (!publicDir || !url.startsWith('/')) {
    return
  }
  const publicFile = path.join(publicDir, cleanUrl(url))
  if (fs.existsSync(publicFile)) {
    return publicFile
  }
}
