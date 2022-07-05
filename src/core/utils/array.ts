/**
 * Convert `arg` to an array and ensure the returned array
 * never contains `undefined` values.
 */
export const toArray = <T>(
  arg: T
): (T extends readonly (infer U)[]
  ? Exclude<U, undefined>
  : Exclude<T, undefined>)[] =>
  arg !== undefined
    ? Array.isArray(arg)
      ? arg.filter(value => value !== undefined)
      : ([arg] as any)
    : []
