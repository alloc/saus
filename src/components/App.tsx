import { Router } from './Router'

export function App(props: { children: JSX.Element }) {
  return (
    <>
      <header></header>
      <main>
        <Router>{props.children}</Router>
      </main>
    </>
  )
}
