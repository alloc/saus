import fs from 'fs'
import path from 'path'

const failedPagesId = 'node_modules/.saus/failed-pages.json'

export function getFailedPages(): string[] {
  try {
    return JSON.parse(fs.readFileSync(failedPagesId, 'utf8'))
  } catch {
    return []
  }
}

export function setFailedPages(pagePaths: string[]) {
  fs.mkdirSync(path.dirname(failedPagesId), { recursive: true })
  fs.writeFileSync(failedPagesId, JSON.stringify(pagePaths))
}
