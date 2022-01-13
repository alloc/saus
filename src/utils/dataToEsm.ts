import { noop } from './noop'

const indent = '  '
const varDeclRE = /^(const|let|var) /

type Replacer = (key: string, value: any) => string | void

/**
 * Convert almost any kind of data to ESM code.
 *
 * By default, `export default` is prepended to the generated code,
 * but the `variable` argument lets you change that. For example,
 * you could pass `"foo"` to prepend `const foo =`, pass an empty
 * string to prepend nothing, or `"let foo"` for a `let foo =` prefix.
 *
 * The `replacer` argument lets you selectively override which code
 * is generated from a specific value.
 */
export function dataToEsm(
  data: unknown,
  variable?: string | null,
  replacer: Replacer = noop
) {
  const prefix = variable
    ? (varDeclRE.test(variable) ? '' : 'const ') + variable + ' = '
    : variable !== ''
    ? 'export default '
    : ''

  return prefix + serialize(data, [], replacer)
}

function serialize(
  value: unknown,
  keyPath: string[],
  replacer: Replacer
): string {
  const key = keyPath.length ? keyPath[keyPath.length - 1] : ''
  const replacement = replacer(key, value)
  if (typeof replacement === 'string') {
    return replacement
  }
  if (
    value == null ||
    value === Infinity ||
    value === -Infinity ||
    Number.isNaN(value) ||
    value instanceof RegExp
  ) {
    return String(value)
  }
  if (value === 0 && 1 / value === -Infinity) {
    return '-0'
  }
  if (value instanceof Date) {
    return `new Date(${value.getTime()})`
  }
  if (Array.isArray(value)) {
    return serializeArray(value, keyPath, replacer)
  }
  if (typeof value === 'object') {
    return serializeObject(value, keyPath, replacer)
  }
  return stringify(value)
}

function stringify(obj: unknown): string {
  return JSON.stringify(obj).replace(
    /[\u2028\u2029]/g,
    char => `\\u${`000${char.charCodeAt(0).toString(16)}`.slice(-4)}`
  )
}

function serializeArray<T>(
  arr: T[],
  keyPath: string[],
  replacer: Replacer
): string {
  let output = '['
  const baseIndent = indent.repeat(keyPath.length)
  const separator = `\n${baseIndent}${indent}`
  for (let i = 0; i < arr.length; i++) {
    output += `${i > 0 ? ',' : ''}${separator}${serialize(
      arr[i],
      keyPath.concat(String(i)),
      replacer
    )}`
  }
  return `${output}\n${baseIndent}]`
}

function serializeObject(
  obj: object,
  keyPath: string[],
  replacer: Replacer
): string {
  let output = '{'
  const baseIndent = indent.repeat(keyPath.length)
  const separator = `\n${baseIndent}${indent}`
  Object.entries(obj).forEach(([key, value], i) => {
    const legalName = /^[$_a-z0-9]+$/i.test(key) ? key : stringify(key)
    output += `${i > 0 ? ',' : ''}${separator}${legalName}: ${serialize(
      value,
      keyPath.concat(String(key)),
      replacer
    )}`
  })
  return `${output}${indent ? `\n${baseIndent}` : ''}}`
}
