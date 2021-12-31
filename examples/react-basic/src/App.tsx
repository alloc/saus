import { Router } from './Router'
import logoPng from '/logo.png'
import './App.css'

export function App(props: { children: JSX.Element }) {
  return (
    <>
      <header>
        <img src={logoPng} />
      </header>
      <main>
        <Router>{props.children}</Router>
      </main>
    </>
  )
}
