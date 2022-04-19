export type Promisable<T> = T | PromiseLike<T>
export type Falsy = false | null | undefined
export type OneOrMany<T> = T | readonly T[]
