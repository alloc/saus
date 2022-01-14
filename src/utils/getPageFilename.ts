/**
 * Get the `.html` filename for a given URL pathname.
 *
 * Beware: Trailing slashes are treated as `/index.html` and querystrings
 * are not supported.
 */
export function getPageFilename(path: string, basePath?: string) {
  if (basePath && new RegExp('^' + basePath + '?$').test(path)) {
    return basePath.slice(1) + 'index.html'
  }
  return path.replace(/(?:\/(index)?)?$/, appendHtmlSuffix).replace(/^\//, '')
}

function appendHtmlSuffix(indexSuffix?: string, indexPath?: string) {
  return (indexPath ? 'index/' : '') + (indexSuffix ? 'index' : '') + '.html'
}
