import { readFileSync } from 'fs'

export function readJson<T = any>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8'))
}
