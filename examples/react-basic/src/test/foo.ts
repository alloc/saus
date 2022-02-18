export let foo1 = 1

let foo2 = 2
export { foo2 }

export let { foo: foo3 } = { foo: 3 }

let [foo4] = [4]
export { foo4 }

export const foo5 = 5

import { bar1 } from './bar'
export { bar1 as renamedBar1 }
export { bar2, bar3 as renamedBar3 } from './bar'

export * from './baz'

export function update() {
  foo1++
  foo2++
  foo3++
  foo4++
}
