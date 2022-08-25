export interface Props {
  accountId: string
  zoneId: string
  /**
   * The route namespace for all matched entries.
   * @see https://developers.cloudflare.com/workers/platform/routing/routes/#matching-behavior
   */
  route: string
  /** All entries are relative to this directory. */
  baseDir: string
  /**
   * Relative globs and/or paths to the worker modules.
   * @default ["*.ts"]
   */
  entries?: string[]
  /**
   * @default false
   */
  minify?: boolean
}
