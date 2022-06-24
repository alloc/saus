import { Promisable } from 'type-fest'

type Start<T> = (resolve: (result: Promisable<T>) => void) => void

export class LazyPromise<T> implements PromiseLike<T> {
  private _start: Start<T> | undefined
  private _result: T | undefined
  private _promise: Promise<T> | undefined

  constructor(start: Start<T>) {
    this._start = start
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): PromiseLike<TResult1 | TResult2> {
    if (this._start) {
      this._promise = new Promise(this._start).then(result => {
        this._promise = undefined
        this._result = result
        return result
      })
      this._start = undefined
    }
    const promise = this._promise || Promise.resolve(this._result!)
    return promise.then(onfulfilled, onrejected)
  }
}
