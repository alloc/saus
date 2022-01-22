import { get } from './http'

export async function jsonImport(url: string) {
  return (await get(url)).toJSON()
}
