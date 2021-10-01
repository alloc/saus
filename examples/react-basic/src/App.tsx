import { Router } from './Router'
import './App.css'

export function App(props: { children: JSX.Element }) {
  return (
    <>
      <Header />
      <main>
        <Router>{props.children}</Router>
      </main>
    </>
  )
}

function Header() {
  return <header></header>
}
