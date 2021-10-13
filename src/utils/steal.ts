export function steal<T extends object, P extends keyof T>(
  obj: T,
  key: P
): T[P] {
  const value = obj[key]
  delete obj[key]
  return value
}
