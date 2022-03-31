import AnsiConverter from 'ansi-to-html'
import endent from 'endent'
import os from 'os'
import { SausContext } from '../core'
import { parseStackTrace } from '../utils/resolveStackTrace'

export function renderErrorFallback(error: any, context: SausContext) {
  const homeDir = os.homedir()
  const message = ansiToHtml(error.message).replace(
    new RegExp('(^|[\\s])(' + homeDir + '/[^\\s:]+)', 'g'),
    (_, space, file) =>
      space +
      (file.startsWith(context.root + '/')
        ? createFileLink(file, context.root)
        : file)
  )

  const stack = parseStackTrace(error.stack).frames.map(frame => {
    const file = frame.file + ':' + frame.line + ':' + (frame.column + 1)
    return (
      `<div class="stack-frame"><span>` +
      frame.text.replace(file, createFileLink(file, context.root)) +
      `</span></div>`
    )
  })

  return endent`
    <link rel="stylesheet" href="/@id/saus/src/pages/errorFallback.css?direct">
    <script type="module" src="/@id/saus/src/pages/errorFallbackClient.js"></script>
    <body>
      <h1>An error occurred while the server was rendering.</h1>
      <small>
        ${renderLoadingIcon('class="waiting"')}
        This page will refresh itself when you save a file.
      </small>
      <div class="error">
        <div class="error-message">${message}</div>
        ${stack.join('\n')}
      </div>
    </body>
  `
}

function createFileLink(file: string, root: string) {
  return (
    `<a class="file-link" href="/__open-in-editor?file=${encodeURI(file)}">` +
    file.replace(new RegExp('^' + root + '/'), '') +
    `</a>`
  )
}

const ansiTheme = {
  0: '#000000',
  1: '#C75646',
  2: '#8EB33B',
  3: '#D0B03C',
  4: '#4E90A7',
  5: '#C8A0D1',
  6: '#218693',
  7: '#B0B0B0',
  10: '#5D5D5D',
  11: '#E09690',
  12: '#CDEE69',
  13: '#FFE377',
  14: '#9CD9F0',
  15: '#FBB1F9',
  16: '#77DFD8',
  17: '#F7F7F7',
}

function ansiToHtml(input: string) {
  const convert = new AnsiConverter({
    newline: true,
    colors: ansiTheme,
  })
  return convert
    .toHtml(input)
    .replace(/\bhttps:\/\/[^\s]+/, match => `<a href="${match}">${match}</a>`)
}

function renderLoadingIcon(attrs = '') {
  const spokes: string[] = []
  for (let i = 0; i < 12; i++) {
    spokes.push(`
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
      ${spokes}
    </svg>
  `
}
