import { escape } from '@saus/utils/escape'
import { isObject } from '@saus/utils/isObject'
import { parseXML } from './xml/parse'

export interface XmlDocument {
  /** Add a self-closing tag. */
  append(tag: string, attrs?: Record<string, any>): XmlDocument
  /** Open a tag with children. */
  open(tag: string, attrs?: Record<string, any>): XmlDocument
  /** Convenience method for defining a list of nodes within another tag. */
  list(
    callback: (
      open: (tag: string, attrs?: Record<string, any>) => XmlDocument
    ) => void
  ): XmlDocument
  /** Insert content into the current tag. */
  insert(
    content: any,
    replacer?: (key: string, value: any, context: Record<string, any>) => any
  ): XmlDocument
  /**
   * Use an object to define child nodes with text content.
   *
   * Nested objects and arrays are supported.
   */
  props(
    contentByTag: Record<string, any>,
    replacer?: (key: string, value: any, context: Record<string, any>) => any
  ): XmlDocument
  /** Close the last opened tag. */
  close(): XmlDocument
  /** Get the formatted XML string. */
  toString(): string
}

export function xml(encoding = 'UTF-8'): XmlDocument {
  let text = `<?xml version="1.0" encoding="${encoding}"?>\n`
  let tagStack: string[] = []

  function openTag(name: string, attrs?: Record<string, any>) {
    tagStack.push(name)
    text += '<' + name
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        text += ` ${key}="${escape(value)}"`
      }
    }
  }

  return {
    append(tag, attrs) {
      openTag(tag, attrs)
      text += '/>'
      return this
    },
    open(tag, attrs) {
      openTag(tag, attrs)
      text += '>'
      return this
    },
    list(callback) {
      let hasOpened = false
      callback((tag, attrs) => {
        if (hasOpened) {
          this.close()
        } else {
          hasOpened = true
        }
        return this.open(tag, attrs)
      })
      if (hasOpened) {
        this.close()
      }
      return this
    },
    insert(value, replacer) {
      if (isObject(value)) {
        this.props(value, replacer)
      } else if (Array.isArray(value)) {
        value.forEach(elem => this.insert(elem, replacer))
      } else {
        text += value
      }
      return this
    },
    props(props, replacer) {
      for (let [key, value] of Object.entries(props)) {
        this.open(key)
        if (replacer) {
          value = replacer(key, value, props)
        }
        this.insert(value, replacer)
        this.close()
      }
      return this
    },
    close() {
      const tag = tagStack.pop()
      if (tag) {
        text += '</' + tag + '>'
      }
      return this
    },
    toString() {
      return text
    },
  }
}

xml.parse = parseXML
