export interface Props {
  /** Relative globs and/or paths to the API functions. */
  entries?: string[]
  /** All entries are relative to this directory. */
  functionDir: string
  /**
   * The branch that Vercel is watching. \
   * This must not be used by another deployment.
   */
  gitBranch: string
  minify?: boolean
}
