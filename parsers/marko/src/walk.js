import { KEYS as VisitorKeys } from 'eslint-visitor-keys'
import MarkoDefinitions from './babel-types/types/definitions'

export function walk(node, visitor, parentKey) {
  visitor.enter(node, parentKey)

  const keys = VisitorKeys[node.type] || MarkoDefinitions[node.type]?.visitor

  if (keys) {
    for (const key of keys) {
      const value = node[key]
      if (Array.isArray(value)) {
        value.forEach((node, i) => {
          walk(node, visitor, key + '.' + i)
        })
      } else if (value && typeof value.type == 'string') {
        walk(value, visitor, key)
      }
    }
  }

  visitor.exit(node, parentKey)
}
