import { readFileSync } from 'fs'

export type Reviver = (this: any, key: string, value: any) => any

export function readJson<T = any>(p: string, reviver?: Reviver): T {
  return JSON.parse(readFileSync(p, 'utf8'), reviver)
}
