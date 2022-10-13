export function plural(count: number, one: string, many?: string) {
  return count + ' ' + (count == 1 ? one : many || one + 's')
}
