export function joinUrl(...parts: (string | undefined)[]) {
  parts = parts.filter(Boolean)
  const head = parts[0] || ''
  const protocol = /^[^./]+:\/\//.exec(head)
  if (protocol) {
    parts[0] = head.slice(protocol[0].length)
  }
  const path = ('/' + parts.join('/')).replace(/\/{2,}/g, '/')
  return protocol ? protocol[0] + path.slice(1) : path
}
