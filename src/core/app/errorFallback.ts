import endent from 'endent'
import { ansiToHtml } from '../node/ansiToHtml'
import { escape } from '../utils/escape'
import { parseStackTrace } from '../utils/parseStackTrace'

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
    <!DOCTYPE html>
    <head>
      <link rel="stylesheet" href="/@id/saus/src/core/app/errorFallback.css?direct">
      <script type="module" src="/@id/saus/src/core/app/errorFallbackClient.js"></script>
    </head>
    <body ${ssr ? '' : 'style="display: none"'}>
      <h1>${
        ssr
          ? 'The server caught an error while rendering'
          : 'The client caught an error while hydrating'
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

function renderTableValue(
  value: any,
  className?: string,
  stack: object[] = []
): string {
  if (value == null || Number.isNaN(value)) {
    return String(value)
  }
  if (typeof value == 'function') {
    return escape(Function.prototype.toString.call(value))
  }
  let rows: string[] | undefined
  if (Array.isArray(value)) {
    if (stack.includes(value)) {
      return '[Circular]'
    }
    if (!value.length) {
      return '[]'
    }
    const maxKeyLength = String(value.length - 1).length
    const width = maxKeyLength * 9
    stack.push(value)
    rows = value.map((value, i) => {
      return renderTableRow(value, i, width, stack)
    })
    stack.pop()
  } else if (typeof value == 'object') {
    if (stack.includes(value)) {
      return '[Circular]'
    }
    if (value.constructor && value.constructor.name !== 'Object') {
      if (typeof value.toJSON == 'function') {
        const json = value.toJSON()
        if (
          json !== null &&
          typeof json == 'object' &&
          (Array.isArray(json) || Object.keys(json).length)
        ) {
          return renderTableValue(json, className, stack)
        }
      }
      return `[object ${value.constructor.name}]`
    }
    const entries = Object.entries(value as Record<string, any>)
    if (!entries.length) {
      return '{}'
    }
    const maxKeyLength = entries.reduce(
      (max, [key]) => Math.max(max, key.length),
      0
    )
    const width = maxKeyLength * 9
    stack.push(value)
    rows = entries.map(([key, value]) => {
      return renderTableRow(value, key, width, stack)
    })
    stack.pop()
  }
  if (rows) {
    return endent`<table${className ? ` class="${className}"` : ''}>
      ${rows.join('\n')}
    </table>`
  }
  const jsonValue = JSON.stringify(value)
  return jsonValue !== undefined
    ? ansiToHtml(jsonValue)
    : Object.prototype.toString.call(value)
}

function renderTableRow(
  value: any,
  key: string | number,
  width: number,
  stack: object[]
): string {
  const valueHtml = renderTableValue(value, '', stack)
  return endent`
    <tr>
      <td class="key" width="${width}px">${key}</td>
      ${
        valueHtml.startsWith('<table')
          ? `<td class="object">${valueHtml}</td>`
          : `<td>${valueHtml}</td>`
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
