import { access, get, has, load } from './access'
import { clear } from './clear'
import { forEach } from './forEach'
import { Cache } from './types'

export const createCache = <State = unknown>(): Cache<State> => ({
  listeners: {},
  loading: {},
  loaded: {},
  has,
  get,
  load,
  access,
  clear,
  forEach,
})
