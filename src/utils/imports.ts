import type { ClientImports } from '../core'
import { SPACE } from '../core/tokens'

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
          : '{' +
            SPACE +
            spec
              .map(spec =>
                typeof spec === 'string' ? spec : spec[0] + ' as ' + spec[1]
              )
              .join(',' + SPACE) +
            SPACE +
            '} from '
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
  const importRE = /\bimport\b *(?:[^.?;]+? *\bfrom *)?["']([\w@$./-]+)["'];?/g

  let match: RegExpExecArray | null
  while ((match = importRE.exec(code))) {
    const source = /["']([^"']+)["']/.exec(match[0])!
    const start = match.index + source.index + 1
    const end = start + source[1].length

    // Parse preceding code to detect false positives.
    const lineStart = code.lastIndexOf('\n', match.index) + 1
    const linePrecedingCode = code.slice(lineStart, match.index)
    if (linePrecedingCode) {
      const previousImport = imports[imports.length - 1]
      const afterPreviousImport =
        previousImport &&
        previousImport.end > lineStart &&
        /; *$/.test(linePrecedingCode)

      if (!afterPreviousImport) {
        // Move the regex cursor to the next line, to avoid
        // false positives on the same line.
        importRE.lastIndex = code.indexOf('\n', end)
        continue
      }
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
