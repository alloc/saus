export function unescape(input: string) {
  return input
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&') // Must happen last or else it will unescape other characters in the wrong order.
}
