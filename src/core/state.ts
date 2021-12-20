export interface StateFragment<T = any, Args extends any[] = any[]> {
  load(...args: Args): Promise<T>
  bind(...args: Args): StateFragment<T, []>
  get(...args: Args): T
}

export type ResolvedState<T> = T extends Promise<any>
  ? Resolved<T>
  : T extends ReadonlyArray<infer Element>
  ? Element[] extends T
    ? readonly Resolved<Element>[]
    : { [P in keyof T]: Resolved<T[P]> }
  : T extends object
  ? { [P in keyof T]: Resolved<T[P]> }
  : ResolvedModule<T>

type Resolved<T> = ResolvedModule<T extends Promise<infer U> ? U : T>

type ResolvedModule<T> = T extends { default: infer DefaultExport }
  ? { default: DefaultExport } extends T
    ? DefaultExport
    : T
  : T
