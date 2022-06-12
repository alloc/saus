import htmlTags from 'html-tags'
import { walk } from './walk'

export function createTemplate(name, file) {
  const stack = []
  const create = (node, state) => {
    if (current.constructor) {
      current.constructor.call(state, node, current)
    }
    current.state = state
    return state
  }
  const open = (type, node) => {
    stack.push(current)
    current = builders[type]
    current = { ...current, __proto__: builders[current.extends] }
    return create(node, {})
  }
  const close = () => {
    current = stack.pop()
  }

  const parseElement = (tagName, node, ctx) => {
    if (tagName == 'const' || tagName == 'let') {
      const init = extractExpression(node.attributes[0].value, file)
      ctx.body.push({
        statement:
          tagName +
          ' ' +
          file.code.slice(node.var.start, node.var.end) +
          ' = ' +
          init,
      })
    } else if (tagName == 'if') {
      const cases = []
      ctx.body.push({ cases })
      cases.push(open('Case', node))
      return () => {
        close()
        if (cases.length == 1) {
          ctx.body[ctx.body.length - 1] = cases[0]
        }
      }
    } else {
      if (tagName == 'for') {
        ctx.body.push(open('For', node))
      } else if (tagName == 'else-if') {
        const prevSibling = ctx.body[ctx.body.length - 1]
        prevSibling.cases.push(open('Case', node))
      } else if (tagName == 'else') {
        const prevSibling = ctx.body[ctx.body.length - 1]
        prevSibling.else = open('Case', node)
      } else {
        ctx.body.push(open('Element', node))
      }
      return close
    }
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
        } else {
          return parseElement(tagName, node, this)
        }
      },
    },
    Element: {
      constructor(node) {
        const tagName = node.name.value
        this.type = htmlTags.includes(tagName) ? tagName : { id: tagName }

        const props = parsePropList(node.attributes, file)
        if (props.length) {
          this.props = props
        }

        if (node.var) {
          this.ref = `const ${file.code.slice(node.var.start, node.var.end)}`
        }

        this.body = []
      },
      MarkoTag(node) {
        const tagName = node.name.value
        return parseElement(tagName, node, this)
      },
      MarkoText(node) {
        this.body.push({
          text: node.value,
        })
      },
      MarkoPlaceholder(node) {
        this.body.push({
          expression: extractExpression(node.value, file),
          escape: node.escape ? true : undefined,
        })
      },
    },
    Case: {
      extends: 'Element',
      constructor(node) {
        this.case = extractExpression(node.attributes[0].value, file)
        this.body = []
      },
    },
    For: {
      extends: 'Element',
      constructor(node) {
        const props = parsePropMap(node.attributes, file)
        if (props.of) {
          this.forOf = props.of
        }
        const { params } = node.body
        if (params.length > 1) {
          this.index = { name: params[1].name }
        }
        this.value = { name: params[0].name }
        this.body = []
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

function parsePropList(attributes, file) {
  return attributes.map(attr => {
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
}

function parsePropMap(attributes, file) {
  const props = parsePropList(attributes, file)
  return props.reduce((props, prop) => {
    props[prop.name] = prop.value
    return props
  }, {})
}
