import type { SausEvents } from '@/context'
import { EventEmitter } from 'ee-ts'

export interface DevEvents {
  listening(): void
  restart(message?: string): void
  close(): void
  error(e: any): void
}

export type DevEventEmitter = EventEmitter<DevEvents & SausEvents>
