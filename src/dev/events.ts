import StrictEventEmitter from 'strict-event-emitter-types'

export interface DevEvents {
  listening(): void
  restart(): void
  close(): void
  error(e: any): void
}

export type DevEventEmitter = StrictEventEmitter<
  import('events').EventEmitter,
  DevEvents
>
