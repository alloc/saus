export function diffObjects(
  oldValues: any,
  values: any,
  changed: Record<string, any> = {},
  dotPaths = new Set<string>(),
  parentPath: string[] = []
) {
  let differs = false
  const diff = (key: string, oldValue: any, value: any) => {
    if (isPlainObject(oldValue) && isPlainObject(value)) {
      if (canCoerceToJson(oldValue)) {
        oldValue = oldValue.toJSON()
      }
      if (canCoerceToJson(value)) {
        value = value.toJSON()
      }
      const cmp = diffObjects(
        oldValue,
        value,
        (changed[key] = {}),
        dotPaths,
        parentPath.concat(key)
      )
      if (cmp) {
        differs = true
      }
    } else if (Array.isArray(oldValue) && Array.isArray(value)) {
      const cmp = equalArrays(
        oldValue,
        value,
        changed,
        dotPaths,
        parentPath.concat(key)
      )
      if (!cmp) {
        changed[key] = differs = true
      }
    } else if (oldValue !== value) {
      changed[key] = differs = true
      dotPaths.add(parentPath.concat(key).join('.'))
    }
  }
  for (const key in values) {
    diff(key, oldValues[key], values[key])
  }
  for (const key in oldValues) {
    if (!(key in values)) {
      diff(key, oldValues[key], values[key])
    }
  }
  return differs
}

function equalArrays(
  oldValues: any[],
  values: any[],
  changed: Record<string, any> = {},
  dotPaths = new Set<string>(),
  parentPath: string[] = []
) {
  if (oldValues.length !== values.length) {
    return false
  }
  for (let i = 0; i < values.length; i++) {
    let value = values[i]
    let oldValue = oldValues[i]
    if (isPlainObject(oldValue) && isPlainObject(value)) {
      if (canCoerceToJson(oldValue)) {
        oldValue = oldValue.toJSON()
      }
      if (canCoerceToJson(value)) {
        value = value.toJSON()
      }
      const cmp = diffObjects(
        oldValue,
        value,
        (changed[i] = {}),
        dotPaths,
        parentPath.concat(i + '')
      )
      if (cmp) {
        return false
      }
    } else if (Array.isArray(oldValue) && Array.isArray(value)) {
      const cmp = equalArrays(
        oldValue,
        value,
        changed,
        dotPaths,
        parentPath.concat(i + '')
      )
      if (!cmp) {
        return false
      }
    } else if (oldValue !== value) {
      dotPaths.add(parentPath.concat(i + '').join('.'))
      return false
    }
  }
  return true
}

function isPlainObject(value: any): value is object {
  return value !== null && typeof value == 'object'
}

function canCoerceToJson(value: object): value is { toJSON(): any } {
  return typeof (value as any).toJSON == 'function'
}
