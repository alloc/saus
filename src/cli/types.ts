import type { InlineBundleConfig } from '../bundle'
import type { BuildOptions } from '../core'

export type BuildFlags = BuildOptions & {
  debug?: boolean
  filter?: string | string[]
}

export type BundleFlags = InlineBundleConfig & {
  minify?: boolean
  mode?: string
  sourcemap?: boolean | 'inline' | 'hidden'
}

export type DeployFlags = {
  dryRun?: true
  cache?: false
}
