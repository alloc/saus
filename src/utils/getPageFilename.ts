/**
 * Get the `.html` filename for a given URL pathname.
 *
 * Beware: Trailing slashes are treated as `/index.html` and querystrings
 * are not supported.
 */
export function getPageFilename(path: string, basePath?: string) {
  if (basePath && path == basePath.slice(0, -1)) {
    return basePath.slice(1) + 'index.html'
  }
  return path.slice(1).replace(/(\/(index)?)?$/, appendHtmlSuffix)
}

function appendHtmlSuffix(indexSuffix?: string, indexPath?: string) {
  return (indexPath ? 'index/' : '') + (indexSuffix ? 'index' : '') + '.html'
}
