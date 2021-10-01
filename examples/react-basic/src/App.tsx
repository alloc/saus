import { Router } from './Router'
import './App.css'

export function App(props: { children: JSX.Element }) {
  return (
    <>
      <header>
        <img src="/logo.png" />
      </header>
      <main>
        <Router>{props.children}</Router>
      </main>
    </>
  )
}
