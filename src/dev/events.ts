import type { SausEvents } from '@/context'
import { EventEmitter } from 'ee-ts'

export interface DevEvents {
  listening(): void
  restart(): void
  close(): void
  error(e: any): void
}

export type DevEventEmitter = EventEmitter<DevEvents & SausEvents>
