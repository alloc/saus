import { ComponentType } from 'react'
import { BareRoute, ClientState } from 'saus/core'

type Remap<T> = {} & {[P in keyof T]: T[P]}

/**
 * Use this to statically type the `state` method of each route.
 * This assumes your route modules export a default component,
 * which expects the route state in its component props.
 */
export type RouteProps<T, K extends string = 'default'> = unknown &
  T extends BareRoute<infer Module>
  ? Module extends { [Key in K]: ComponentType<infer Props> }
    ? Remap<Omit<Props, keyof ClientState>>
    : unknown
  : unknown
