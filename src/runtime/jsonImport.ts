import { get } from '../core/http'

export async function jsonImport(url: string) {
  return (await get(url)).toJSON()
}
