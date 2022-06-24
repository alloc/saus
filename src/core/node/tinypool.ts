import Tinypool from 'tinypool'

const dynamicImport = (0, eval)('id => import(id)')

// Tinypool is ESM only, so use dynamic import to load it.
export const loadTinypool = async () =>
  ((await dynamicImport('tinypool')) as typeof import('tinypool')).default

export type { Tinypool } from 'tinypool'

export type WorkerPool<Commands extends object> = Omit<Tinypool, 'run'> & {
  run<P extends keyof Commands>(
    task: [P, ...Parameters<Extract<Commands[P], Fn>>],
    options?: Parameters<Tinypool['run']>[1]
  ): Promise<Awaited<Exclude<ReturnType<Extract<Commands[P], Fn>>, void>>>
}

type Fn = (...args: any[]) => any
