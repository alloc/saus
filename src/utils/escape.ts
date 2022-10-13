// Adapted from the `escape-goat` package.

export function escape(
  strings: string | TemplateStringsArray,
  ...values: any[]
) {
  if (typeof strings === 'string') {
    return escapeHtml(strings)
  }

  let output = strings[0]
  for (const [index, value] of values.entries()) {
    output = output + escapeHtml(String(value)) + strings[index + 1]
  }

  return output
}

// Multiple `.replace()` calls are actually faster than using replacer functions.
const escapeHtml = (html: string) =>
  html
    .replace(/&/g, '&amp;') // Must happen first or else it will escape other just-escaped characters.
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
