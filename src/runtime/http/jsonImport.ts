import { get } from './get'

export type JsonModule = { default: any }

export async function jsonImport(url: string): Promise<JsonModule> {
  const json = (await get(url)).toJSON()
  return { default: json }
}
