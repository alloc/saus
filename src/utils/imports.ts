import type { ClientImports } from '../core'

export function serializeImports(imports: ClientImports) {
  return Object.entries(imports).map(
    ([source, spec]) =>
      `import ${
        typeof spec === 'string'
          ? spec
          : '{ ' +
            spec
              .map(spec =>
                typeof spec === 'string' ? spec : spec[0] + ' as ' + spec[1]
              )
              .join(', ') +
            ' }'
      } from "${source}"`
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
  const importRE = /^import .+/gm

  let match: RegExpExecArray | null
  while ((match = importRE.exec(code))) {
    const source = /"([^"]+)"/.exec(match[0])!
    const start = match.index + source.index + 1
    const end = start + source[1].length

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
