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
