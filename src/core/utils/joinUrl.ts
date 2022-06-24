
export function joinUrl(...parts: (string | undefined)[]) {
  return ('/' + parts.filter(Boolean).join('/')).replace(/\/{2,}/g, '/')
}
