import type { ClientState, StateModule } from '../client'
import type { Headers } from '../http'

/**
 * The identifiers of all "state modules" used by a given page
 * is persisted in this `WeakMap` for as long as its `ClientState`
 * is kept in memory. This prevents the identifier list from being
 * sent to the client.
 */
export const stateModulesMap = new WeakMap<ClientState, string[]>()

/**
 * These state modules will be inlined with the page state.
 */
export const inlinedStateMap = new WeakMap<ClientState, Set<StateModule>>()

/**
 * The `route.headProps` value is resolved at the same time as the
 * initial client state. This relationship is persisted in this `WeakMap`
 * for as long as the `ClientState` is kept in memory. This prevents the
 * head props from being sent to the client.
 */
export const headPropsCache = new WeakMap<ClientState, Record<string, any>>()

export const emptyArray: ReadonlyArray<any> = Object.freeze([])
export const emptyHeaders: Readonly<Headers> = Object.freeze({})
