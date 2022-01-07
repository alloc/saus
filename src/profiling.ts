import elaps from 'elaps'
import { debug } from './core/debug'

export const Profiling: { mark(name: string): void } = process.env.PROFILE
  ? elaps()
  : { mark: debug }
