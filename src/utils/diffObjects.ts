export function diffObjects(
  oldValues: any,
  values: any,
  changed: Record<string, any>
) {
  let differs = false
  const diff = (key: string, oldValue: any, value: any) => {
    if (isPlainObject(oldValue) && isPlainObject(value)) {
      if (diffObjects(oldValue, value, (changed[key] = {}))) {
        differs = true
      }
    } else if (Array.isArray(oldValue) && Array.isArray(value)) {
      if (!equalArrays(oldValue, value)) {
        changed[key] = differs = true
      }
    } else if (oldValue !== value) {
      changed[key] = differs = true
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

function equalArrays(oldValues: any[], values: any[]) {
  if (oldValues.length !== values.length) {
    return false
  }
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    const oldValue = oldValues[i]
    if (isPlainObject(oldValue) && isPlainObject(value)) {
      if (diffObjects(oldValue, value, {})) {
        return false
      }
    } else if (Array.isArray(oldValue) && Array.isArray(value)) {
      if (!equalArrays(oldValue, value)) {
        return false
      }
    } else if (oldValue !== value) {
      return false
    }
  }
  return true
}

function isPlainObject(value: any): value is object {
  return value !== null && typeof value == 'object'
}
