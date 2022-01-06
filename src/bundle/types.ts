export interface RenderedPage {
  id: string
  html: string
  modules: Set<ClientModule>
  assets: Set<ClientModule>
}

export interface ClientModule {
  id: string
  text: string
  imports?: string[]
  exports?: string[]
}

declare function renderPage(pageUrl: string): Promise<RenderedPage | null>
export default renderPage

/**
 * If you want to cache modules in-memory and serve them, this function
 * will be helpful. It returns the URL pathname that your server should
 * respond to for each module.
 */
export declare function getModuleUrl(module: ClientModule): string

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
export declare function writePages(
  pages: ReadonlyArray<RenderedPage | null>,
  outDir: string
): Record<string, number>

/**
 * Print a bunch of files kind of like Vite does.
 *
 * @param logger The object responsible for printing
 * @param files File names (relative to the `outDir`) mapped to their size in kilobytes
 * @param outDir The directory (relative to your project root) where all given files reside
 * @param sizeLimit Highlight files larger than the given number of kilobytes (default: `500`)
 */
export declare function printFiles(
  logger: { info(arg: string): void },
  files: Record<string, number>,
  outDir: string,
  sizeLimit?: number
): void