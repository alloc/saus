import Tinypool from 'tinypool'
import { lazyImport } from './lazyImport'

// Tinypool is ESM only, so use dynamic import to load it.
export const loadTinypool = async () =>
  ((await lazyImport('tinypool')) as typeof import('tinypool')).default

export type { Tinypool } from 'tinypool'

export type WorkerPool<Commands extends object> = Omit<Tinypool, 'run'> & {
  run<P extends keyof Commands>(
    task: [P, ...Parameters<Extract<Commands[P], Fn>>],
    options?: Parameters<Tinypool['run']>[1]
  ): Promise<Awaited<Exclude<ReturnType<Extract<Commands[P], Fn>>, void>>>
}

type Fn = (...args: any[]) => any
