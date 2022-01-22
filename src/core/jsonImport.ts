import { get } from './http'

export async function jsonImport(url: string) {
  return JSON.parse(await get(url))
}
