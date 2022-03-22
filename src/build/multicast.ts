import { MessageChannel, MessagePort } from 'worker_threads'
import { EventEmitter } from 'events'

/**
 * Send/receive statically typed events to/from multiple threads.
 */
export class Multicast<Events extends object> {
  private _port?: MessagePort
  private _channels?: Set<MessageChannel>
  private _emitter = new EventEmitter()

  constructor(port?: MessagePort) {
    this._port = port
    this._channels = port ? undefined : new Set()
  }

  /**
   * Each thread needs its own channel.
   */
  newChannel() {
    if (!this._channels) {
      throw Error('Channel cannot be created by a worker thread')
    }
    const channel = new MessageChannel()
    this._channels.add(channel)
    channel.port2.on('message', ([type, args]) => {
      this._emitter.emit(type, ...args)
    })
    return channel.port1
  }

  on<P extends Extract<keyof Events, string>>(
    type: P,
    handler: Extract<Events[P], VoidFn>
  ) {
    this._emitter.on(type, handler)
    return this
  }

  emit<P extends Extract<keyof Events, string>>(
    type: P,
    ...args: Parameters<Extract<Events[P], VoidFn>>
  ) {
    if (this._port) {
      this._port.postMessage([type, args])
    } else if (this._channels) {
      for (const channel of this._channels) {
        channel.port2.postMessage([type, args])
      }
    }
  }
}

type VoidFn = (...args: any) => void
