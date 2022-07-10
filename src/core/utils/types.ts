export type PossibleKeys<T> = T extends any ? string & keyof T : never
export type PossibleValues<T, P extends keyof any> = {
  [K in P]: T extends any ? (P extends keyof T ? T[P] : never) : never
}

export type PickResult<T, P extends keyof any> = [T] extends [object]
  ? PossibleValues<T, P>
  : Partial<PossibleValues<T, P>>

export type JSONObject = { [key: string]: JSON }
export type JSON =
  | JSONObject
  | readonly JSON[]
  | string
  | number
  | boolean
  | null
  | undefined

export type Promisable<T> = T | PromiseLike<T>
export type Falsy = false | null | undefined
export type OneOrMany<T> = T | readonly T[]
export type ExtractProps<T, U> = Pick<
  T,
  keyof T extends infer P
    ? P extends keyof T
      ? T[P] extends U
        ? P
        : never
      : never
    : never
>

// https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546
export type NoInfer<T> = [T][T extends any ? 0 : never]

type Remap<T> = {} & { [P in keyof T]: T[P] }
type ArrayKeys<T> = keyof ExtractProps<T, readonly any[]>
type ObjectKeys<T> = Exclude<keyof ExtractProps<T, object>, ArrayKeys<T>>

/**
 * Declare a nested object map that tells you which
 * properties have changed.
 */
export type Changed<T> = Remap<
  {
    [P in ObjectKeys<T>]: T[P] extends any ? Changed<T[P]> : never
  } & {
    [P in keyof T]?: T[P] extends infer U
      ? U extends object
        ? U extends any[]
          ? true
          : Changed<T[P]>
        : U extends undefined
        ? never
        : true
      : never
  }
>

export type AnyToObject<T, U extends object | null = Record<string, any>> = [
  T
] extends [Any]
  ? U
  : T

/**
 * Used for `any` conditions.
 *
 *     type Example<T> = [T] extends [Any] ? 1 : 0
 */
export declare class Any {
  private _: any
}
