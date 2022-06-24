import { get } from './get'

export async function jsonImport(url: string) {
  return (await get(url)).toJSON()
}
