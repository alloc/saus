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
    const legalName = /^[$_a-z0-9]+$/i.test(key) ? key : stringify(key)
    output += `${i > 0 ? ',' : ''}${separator}${legalName}: ${serialize(
      value,
      baseIndent + indent
    )}`
  }
  return `${output}${indent ? `\n${baseIndent}` : ''}}`
}
