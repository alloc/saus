import type { ClientImports } from '../core'

export function serializeImports(imports: ClientImports | string[]) {
  return (
    Array.isArray(imports)
      ? imports.map(source => [source, ''])
      : Object.entries(imports)
  ).map(
    ([source, spec]) =>
      `import ${
        typeof spec === 'string'
          ? spec
            ? spec + ' from '
            : ''
          : spec.length == 0
          ? ''
          : '{ ' +
            spec
              .map(spec =>
                typeof spec === 'string' ? spec : spec[0] + ' as ' + spec[1]
              )
              .join(', ') +
            ' } from '
      }"${source}"`
  )
}

export type ParsedImport = {
  text: string
  source: {
    value: string
    start: number
    end: number
  }
  start: number
  end: number
}

export function parseImports(code: string) {
  const imports: ParsedImport[] = []
  const importRE = /\bimport (?:[\n\s\S]+? from )?["']([\w@$./-]+)["'];?/g

  let match: RegExpExecArray | null
  while ((match = importRE.exec(code))) {
    const source = /["']([^"']+)["']/.exec(match[0])!
    const start = match.index + source.index + 1
    const end = start + source[1].length

    // Try to avoid false positives from string literals.
    if (!/(^|\n|; *)$/.test(code.slice(0, match.index))) {
      continue
    }

    imports.push({
      text: match[0],
      source: {
        value: source[1],
        start,
        end,
      },
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return imports
}
