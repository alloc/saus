import type { CommonClientProps, StateModule } from '../client'
import type { Headers } from '../http'

/**
 * The identifiers of all "state modules" used by a given page
 * is persisted in this `WeakMap` for as long as its client props
 * are kept in memory. This prevents the identifier list from being
 * sent to the client.
 */
export const stateModulesMap = new WeakMap<
  CommonClientProps<any>,
  Array<string>
>()

/**
 * These state modules will be inlined with the client props.
 */
export const inlinedStateMap = new WeakMap<
  CommonClientProps<any>,
  Set<StateModule>
>()

/**
 * Prevent the head-only props from being sent to the client while
 * allowing them to be retrieved with a reference to the client props.
 */
export const headPropsCache = new WeakMap<
  CommonClientProps<any>,
  Record<string, any>
>()

export const emptyArray: ReadonlyArray<any> = Object.freeze([])
export const emptyHeaders: Readonly<Headers> = Object.freeze({})
