import type { ParsedRoute } from '../core/routes'

export function parseRoutePath(path: string): ParsedRoute {
  let pattern = '',
    keys: string[] = [],
    match: RegExpExecArray | null,
    lastMatch: RegExpExecArray | undefined

  path.split('/').forEach(part => {
    if (!part) return
    let wip = '/'

    const partRegex = /(?:(\*)|(\?)|(:)?([^?.*]+)|(\.[^*]*))/g
    while ((match = partRegex.exec(part))) {
      // WILD TOKEN (*)
      if (match[1]) {
        if (match.index) {
          // If an asterisk exists in the middle or end,
          // it's not captured and it respects slashes.
          wip += '[^/]*?'
        } else {
          // If an asterisk comes first, it's captured as "wild"
          // and all slashes are ignored when capturing.
          wip += '(.*)'
          keys.push('wild')
        }
      }
      // OPTIONAL TOKEN (?)
      else if (match[2]) {
        // The whole part is made optional, unless a period precedes
        // this token; in which case, only the character before this
        // token is made optional.
        wip = `(?:${wip})?`
      }
      // NAMED PARAMETERS (:)
      else if (match[3]) {
        let param = match[4]
        let paramPattern = '[^/]+?'

        // Parentheses mark a custom pattern.
        const start = param.indexOf('(', 1) + 1
        if (start) {
          const end = param.indexOf(')', start)
          paramPattern = param.substring(start, end)
          param = param.substring(0, start - 1)
        }

        wip += `(${paramPattern})`
        keys.push(param)
      }
      // PLAIN TEXT
      else if (match[4]) {
        wip += match[4]
      }
      // PERIODS
      else if (match[5]) {
        // They must be escaped.
        wip += match[5].replace(/\./g, '\\.')
      }
      lastMatch = match
    }

    pattern += wip
  })

  // If an extension comes last, disallow trailing slash.
  pattern += lastMatch?.[5] ? '$' : '/?$'

  return {
    keys,
    pattern: new RegExp('^' + pattern, 'i'),
  }
}
