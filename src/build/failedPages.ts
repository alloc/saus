import fs from 'fs'

const failedPagesId = 'node_modules/.saus/failed-pages.json'

export function getFailedPages(): string[] {
  try {
    return JSON.parse(fs.readFileSync(failedPagesId, 'utf8'))
  } catch {
    return []
  }
}

export function setFailedPages(pagePaths: string[]) {
  fs.writeFileSync(failedPagesId, JSON.stringify(pagePaths))
}
