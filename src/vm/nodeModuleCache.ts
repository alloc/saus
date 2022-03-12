import { Module } from 'module'

export function getCachedModule(id: string): NodeModule | undefined {
  return (Module as any)._cache[id]
}
