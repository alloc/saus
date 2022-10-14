export function take<K, V>(map: Map<K, V>, key: K): V | undefined {
  const value = map.get(key)
  map.delete(key)
  return value
}
