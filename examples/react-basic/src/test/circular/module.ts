import { foo5, bar2 } from '../foo'

export let circular1 = 1

setInterval(() => {
  circular1 = foo5 + bar2
}, 1)
