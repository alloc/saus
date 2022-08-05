import { unescape } from './unescape'

export interface XmlParserOptions {
  arrayTags?: string[]
  booleanTags?: string[]
  numberTags?: string[]
}

function createValue(name: string, value: string, opts: XmlParserOptions) {
  return opts.booleanTags?.includes(name)
    ? value == 'true'
    : opts.numberTags?.includes(name)
    ? +value
    : value
}

function createContext(name: string, opts: XmlParserOptions) {
  return opts.arrayTags?.includes(name) ? [] : {}
}

export function parseXML(input: string, opts: XmlParserOptions = {}) {
  let char = input[0]
  let cursor = 0
  let context: any = createContext('', opts)
  let lastTag: Tag | undefined
  let openTags: Tag[] = []
  let insideTag = false

  function move(distance: number) {
    cursor += distance
    char = input[cursor]
  }

  function slice(start: number, end?: number) {
    return input.slice(cursor + start, end ? cursor + end : undefined)
  }

  function parseText(patt: RegExp) {
    if (!patt.global) throw 'parseText needs global regex'
    patt.lastIndex = cursor
    const match = patt.exec(input)!
    cursor = patt.lastIndex
    char = input[cursor]
    return match[1] ?? match[0]
  }

  function parseWord() {
    return parseText(/[a-z0-9_]+/gi)
  }

  // Do nothing with attributes.
  function parseAttribute() {
    try {
      parseWord()
      parseText(/ *= *"([^"]+)"/g)
    } catch {}
  }

  function addProperty(name: string, value: any) {
    // Add an element to the array context.
    if (Array.isArray(context)) {
      context.push(value)
    }
    // Assume an array context if tag names are repeated.
    else if (name in context) {
      if (Array.isArray(context[name])) {
        context[name].push(value)
      } else if (Object.keys(context).length == 1) {
        context = Object.values(context)
        context.push(value)
      } else {
        context[name] = [context[name]]
        context[name].push(value)
      }
    }
    // Set a property in the object context.
    else {
      context[name] = value
    }
  }

  // Remove <?xml> tag
  input = input.replace(/^\s*<\?xml .+?\?>\s*/, '')

  let tagInProgress = { name: '' }
  while (cursor < input.length) {
    const nextTwoChars = slice(0, 2)

    if (insideTag) {
      // End of self-closing tag
      if (/\/>/.test(nextTwoChars)) {
        insideTag = false
        addProperty(tagInProgress.name, true)
        move(+2)
      }
      // End of opening tag
      else if (char == '>') {
        insideTag = false
        openTags.push(
          (lastTag = {
            name: tagInProgress.name,
            value: '',
            context: null,
          })
        )
        move(+1)
      }
      // Attribute parsing
      else {
        parseText(/\s*/g)
        parseAttribute()
      }
    }
    // Start of opening tag
    else if (/^<[a-z0-9_]/i.test(nextTwoChars)) {
      move(+1)
      tagInProgress.name = parseWord()
      insideTag = true

      if (lastTag && !lastTag.context) {
        lastTag.context = context
        context = createContext(lastTag.name, opts)
      }
    }
    // Start of closing tag
    else if (openTags.length && /^<\//i.test(nextTwoChars)) {
      let closedTag: Tag | undefined
      let closedContext: any
      move(+2)
      const name = parseWord()
      for (let i = openTags.length; --i >= 0; ) {
        const tag = openTags[i]
        if (tag.name == name) {
          closedTag = tag
          if (closedTag.context) {
            closedContext = context
            context = closedTag.context
          }
          openTags = openTags.slice(0, i)
          lastTag = openTags[openTags.length - 1]
        }
      }
      parseText(/\s*>/g)
      if (closedTag) {
        const { name, value } = closedTag
        if (closedContext) {
          addProperty(name, closedContext)
        } else if (value !== '') {
          addProperty(name, createValue(name, unescape(value), opts))
        }
      }
    }
    // Value parsing
    else if (lastTag) {
      lastTag.value += char
      move(+1)
    }
  }

  return context
}

interface Tag {
  name: string
  value: string
  /** Parent context */
  context: any
}
