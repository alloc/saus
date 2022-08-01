import { Promisable } from 'type-fest'

export interface PurgeOptions {
  /**
   * Which pages should be purged. Wildcard globs are allowed.
   *
   * Do not include the `.html` suffix in these paths.
   */
  pages?: string[]
  /**
   * Specific files that should be purged.
   *
   * The file URLs are relative to the root of the site
   * and should *not* have a leading slash.
   */
  files?: string[]
}

export interface PurgeRequest {
  trigger: 'deploy' | 'route'
  files: Set<string>
  paths: Set<string>
  globs: Set<string>
}

export interface PurgePlugin {
  name: string
  purge(request: PurgeRequest): Promisable<void>
  expandGlobs?(globs: Set<string>): Promisable<string[]>
}

export interface PurgedRoute {
  path: string
  /**
   * The route `path` converted into a wildcard glob,
   * since cache invalidation often uses such a glob.
   *
   * @example "/book/:id" => "/book/*"
   */
  glob: string
}

export interface PurgedFile {
  path: string
}
