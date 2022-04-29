import endent from 'endent'
import { ansiToHtml } from '../utils/ansiToHtml'
import { escape } from '../utils/escape'
import { parseStackTrace } from '../utils/resolveStackTrace'

interface Options {
  root: string
  origin?: string
  homeDir?: string
  ssr?: boolean
}

export function renderErrorFallback(
  error: any,
  { root, origin, homeDir = origin || root, ssr }: Options
) {
  const message = ansiToHtml(escape(error.message)).replace(
    new RegExp('(^|[\\s])(' + homeDir + '/[^\\s:]+)', 'g'),
    (_, space, file) =>
      space +
      (!ssr || file.startsWith(root + '/')
        ? createFileLink(file, root, origin)
        : file)
  )

  const stack = parseStackTrace(error.stack).frames.map(frame => {
    const file = frame.file + ':' + frame.line + ':' + (frame.column + 1)
    return (
      `<div class="stack-frame"><span>` +
      escape(frame.text).replace(file, createFileLink(file, root, origin)) +
      `</span></div>`
    )
  })

  const errorProps = renderTableValue(
    omitKeys(error, ['message', 'stack']),
    'error-props'
  )

  return endent`
    <link rel="stylesheet" href="/@id/saus/src/app/errorFallback.css?direct">
    <script type="module" src="/@id/saus/src/app/errorFallbackClient.js"></script>
    <body ${ssr ? '' : 'style="display: none"'}>
      <h1>An error occurred while the ${
        ssr ? 'server was rendering' : 'client was hydrating'
      }.</h1>
      <small>
        ${renderLoadingIcon('class="waiting"')}
        This page will refresh itself when you save a file.
      </small>
      <div class="error">
        <div class="error-message">${message}</div>
        ${stack.join('\n')}
      </div>
      ${errorProps ? `<div class="properties">${errorProps}</div>` : ``}
    </body>
  `
}

function createFileLink(file: string, root: string, origin?: string) {
  if (origin) {
    file = file.replace(new RegExp('^' + origin + '/'), '/')
    if (file.startsWith('/@fs/')) {
      file = file.slice(4)
    } else {
      file = root + file
    }
  }
  return (
    `<a class="file-link" href="/__open-in-editor?file=${encodeURI(file)}">` +
    file.replace(new RegExp('^' + root + '/'), '') +
    `</a>`
  )
}

function renderLoadingIcon(attrs = '') {
  const spokes: string[] = []
  for (let i = 0; i < 12; i++) {
    spokes.push(endent`
      <use href="#spoke" transform="rotate(${30 * i} 50 50)">
        <animate attributeName="opacity" values="0;1;0" dur="1s" 
          begin="${0.08 * i}s" repeatCount="indefinite"></animate>
      </use>
    `)
  }
  return endent`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attrs} overflow="visible" fill="#494949">
      <defs>
        <rect id="spoke" x="46.5" y="40" width="7" height="20" rx="2" ry="2" transform="translate(0 -30)"></rect>
      </defs>
      ${spokes.join('\n')}
    </svg>
  `
}

function renderTableValue(value: any, className?: string) {
  let rows: string[] | undefined
  if (Array.isArray(value)) {
    if (!value.length) {
      return ''
    }
    const maxKeyLength = String(value.length - 1).length
    const width = maxKeyLength * 9
    rows = value.map((value, i) => renderTableRow(value, i, width))
  }
  if (value && typeof value == 'object') {
    const entries = Object.entries(value as Record<string, any>)
    if (!entries.length) {
      return ''
    }
    const maxKeyLength = entries.reduce(
      (max, [key]) => Math.max(max, key.length),
      0
    )
    const width = maxKeyLength * 9
    rows = entries.map(([key, value]) => renderTableRow(value, key, width))
  }
  if (rows) {
    return endent`<table${className ? ` class="${className}"` : ''}>
      ${rows.join('\n')}
    </table>`
  }
  if (value === undefined) {
    return 'undefined'
  }
  return ansiToHtml(JSON.stringify(value))
}

function renderTableRow(
  value: any,
  key: string | number,
  width: number
): string {
  const valueHtml = renderTableValue(value)
  return endent`
    <tr>
      <td class="key" width="${width}px">${key}</td>
      ${
        value && typeof value == 'object' && valueHtml
          ? `<td class="object">${valueHtml}</td>`
          : `<td>${valueHtml || (Array.isArray(value) ? '[]' : '{}')}</td>`
      }
    </tr>
  `
}

function omitKeys(obj: any, keys: string[]) {
  return Object.getOwnPropertyNames(obj).reduce((res, key) => {
    if (!keys.includes(key)) {
      res[key] = obj[key]
    }
    return res
  }, {} as any)
}
