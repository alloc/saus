import type { ClientState } from '../context'

declare const document: { querySelector: (selector: string) => any }

const stateContainer = document.querySelector('#STITE_DATA')
const state = JSON.parse(stateContainer.textContent) as ClientState
stateContainer.remove()

const initialRoute = import(state.routeModuleId /* @vite-ignore */)

export { state, initialRoute }
