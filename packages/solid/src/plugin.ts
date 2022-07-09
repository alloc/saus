import type { Plugin } from 'vite'
import viteSolid, { Options } from 'vite-plugin-solid'

export default (options?: Options): Plugin =>
  viteSolid({ ...options, ssr: true })
