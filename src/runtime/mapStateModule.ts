import type { StateModule } from './stateModules'

/**
 * Wrap a state module with a mapping function that
 * transforms the result
 */
export function mapStateModule<T, U>(
  module: StateModule<T, []>,
  map: (state: T) => U
): StateModule<U, []> {
  let lastInput: T
  let lastOutput: U

  const clone: StateModule<U> = Object.create(
    Object.getOwnPropertyDescriptors(module)
  )
  clone.get = () => {
    const input = module.get()
    return input !== lastInput
      ? (lastOutput = map((lastInput = input)))
      : lastOutput
  }
  clone.load = () => {
    return module.load().then(input => {
      return (lastOutput = map((lastInput = input)))
    })
  }
  return clone
}
