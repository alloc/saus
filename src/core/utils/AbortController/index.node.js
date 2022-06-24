import { EventEmitter } from 'events'

export class AbortSignal {
  eventEmitter = new EventEmitter()
  onabort = null
  aborted = false

  toString() {
    return '[object AbortSignal]'
  }
  get [Symbol.toStringTag]() {
    return 'AbortSignal'
  }
  removeEventListener(name, handler) {
    this.eventEmitter.removeListener(name, handler)
  }
  addEventListener(name, handler) {
    this.eventEmitter.on(name, handler)
  }
  dispatchEvent(type) {
    const event = { type, target: this }
    const handlerName = `on${type}`

    if (typeof this[handlerName] === 'function') this[handlerName](event)

    this.eventEmitter.emit(type, event)
  }
}

export class AbortController {
  signal = new AbortSignal()

  abort() {
    if (this.signal.aborted) return

    this.signal.aborted = true
    this.signal.dispatchEvent('abort')
  }
  toString() {
    return '[object AbortController]'
  }
  get [Symbol.toStringTag]() {
    return 'AbortController'
  }
}
