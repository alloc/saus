import htmlTags from 'html-tags'
import { walk } from './walk'

export function createTemplate(name, file) {
  const stack = []
  const create = (node, state) => {
    if (current.constructor) {
      current.constructor.call(state, node)
    }
    current.state = state
    return state
  }
  const push = (type, node) => {
    stack.push(current)
    current = { ...builders[type] }
    return create(node, {})
  }
  const pop = () => {
    current = stack.pop()
  }

  const builders = {
    Component: {
      MarkoTag(node) {
        const tagName = node.name.value
        if (tagName == 'attrs') {
          const props = (this.props = [])
          for (const { key, value } of node.var.properties) {
            const prop = { id: key.name }
            if (key.start !== value.start) {
              prop.alias = { name: value.name }
            }
            props.push(prop)
          }
        } else if (tagName == 'const' || tagName == 'let') {
          const init = extractExpression(node.attributes[0].value, file)
          this.body.push({
            statement:
              tagName +
              ' ' +
              file.code.slice(node.var.start, node.var.end) +
              ' = ' +
              init,
          })
        } else {
          const element = push('Element', node)
          this.body.push(element)
          return pop
        }
      },
    },
    Element: {
      constructor(node) {
        const tagName = node.name.value
        this.type = htmlTags.includes(tagName) ? tagName : { id: tagName }

        const props = node.attributes.map(attr => {
          let value = attr.value
          if (value.type == 'StringLiteral') {
            value = value.value
          } else if (value.type == 'BooleanLiteral' && !value.loc) {
            value = true
          } else {
            value = {
              expression: extractExpression(value, file),
            }
          }
          return {
            name: attr.name,
            value,
          }
        })

        if (props.length) {
          this.props = props
        }

        if (node.var) {
          this.ref = `const ${file.code.slice(node.var.start, node.var.end)}`
        }
      },
    },
  }

  let depth = 0
  let current = builders.Component

  const component = create(file.ast.program, {
    name,
    body: [],
  })

  const exitFns = new WeakMap()
  for (const node of file.ast.program.body) {
    walk(node, {
      enter(node, key) {
        if (current[node.type]) {
          const exitFn = current[node.type].call(current.state, node)
          if (exitFn) {
            exitFns.set(node, exitFn)
          }
        }

        console.log(
          '· '.repeat(depth) +
            (key ? key + ' = ' : '') +
            (node.type == 'StringLiteral'
              ? JSON.stringify(node.value)
              : node.type)
        )
        if (node.type == 'MarkoAttribute') {
          console.log(
            '· '.repeat(depth + 1) + 'name = ' + JSON.stringify(node.name)
          )
        }

        depth++
      },
      exit(node) {
        depth--

        const exitFn = exitFns.get(node)
        exitFn?.()
      },
    })
  }

  return component
}

function extractExpression(node, file) {
  if (node.type == 'FunctionExpression') {
    const params = node.params.map(param =>
      file.code.slice(param.start, param.end)
    )
    return (
      `(${params.join(', ')}) => ` +
      file.code.slice(node.body.start, node.body.end)
    )
  }
  return file.code.slice(node.start, node.end)
}
