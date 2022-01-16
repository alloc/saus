export function prependBase(id: string) {
  return import.meta.env.BASE_URL + id.replace(/^\//, '')
}
