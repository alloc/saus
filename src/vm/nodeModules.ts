import { Module } from 'module'

export function getNodeModule(id: string): NodeModule | undefined {
  return (Module as any)._cache[id]
}

export function invalidateNodeModule(id: string) {
  delete (Module as any)._cache[id]
}
