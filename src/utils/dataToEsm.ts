const indent = '  '
const varDeclRE = /^(const|let|var) /

export function dataToEsm(data: unknown, variable?: string) {
  const prefix = variable
    ? (varDeclRE.test(variable) ? '' : 'const ') + variable + ' = '
    : 'export default '

  return prefix + serialize(data, '')
}

function serialize(obj: unknown, baseIndent: string): string {
  if (
    obj == null ||
    obj === Infinity ||
    obj === -Infinity ||
    Number.isNaN(obj) ||
    obj instanceof RegExp
  ) {
    return String(obj)
  }
  if (obj === 0 && 1 / obj === -Infinity) {
    return '-0'
  }
  if (obj instanceof Date) {
    return `new Date(${obj.getTime()})`
  }
  if (Array.isArray(obj)) {
    return serializeArray(obj, baseIndent)
  }
  if (typeof obj === 'object') {
    return serializeObject(obj!, baseIndent)
  }
  return stringify(obj)
}

function stringify(obj: unknown): string {
  return JSON.stringify(obj).replace(
    /[\u2028\u2029]/g,
    char => `\\u${`000${char.charCodeAt(0).toString(16)}`.slice(-4)}`
  )
}

function serializeArray<T>(arr: T[], baseIndent: string): string {
  let output = '['
  const separator = `\n${baseIndent}${indent}`
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i]
    output += `${i > 0 ? ',' : ''}${separator}${serialize(
      key,
      baseIndent + indent
    )}`
  }
  return `${output}\n${baseIndent}]`
}

function serializeObject(obj: object, baseIndent: string): string {
  let output = '{'
  const separator = `\n${baseIndent}${indent}`
  const entries = Object.entries(obj)
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i]
    const stringKey = makeLegalIdentifier(key) === key ? key : stringify(key)
    output += `${i > 0 ? ',' : ''}${separator}${stringKey}: ${serialize(
      value,
      baseIndent + indent
    )}`
  }
  return `${output}${indent ? `\n${baseIndent}` : ''}}`
}

const reservedWords =
  'break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public'

const builtins =
  'arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl'

const forbiddenIdentifiers = new Set<string>(
  `${reservedWords} ${builtins}`.split(' ')
)
forbiddenIdentifiers.add('')

function makeLegalIdentifier(str: string) {
  let identifier = str
    .replace(/-(\w)/g, (_, letter) => letter.toUpperCase())
    .replace(/[^$_a-zA-Z0-9]/g, '_')

  if (/\d/.test(identifier[0]) || forbiddenIdentifiers.has(identifier)) {
    identifier = `_${identifier}`
  }

  return identifier || '_'
}
