import { JSX } from 'solid-js'
import './App.css'

export function App(props: { children: JSX.Element }) {
  return (
    <>
      <header>
        <img src="/logo.png" />
      </header>
      <main>{props.children}</main>
    </>
  )
}
