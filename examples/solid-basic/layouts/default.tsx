import { defineLayout } from '@saus/solid'
import { routes } from 'saus/client'
import { Link, Router, useRoutes } from 'solid-app-router'
import { createSignal, lazy } from 'solid-js'

const solidRoutes = Object.entries(routes).map(([path, entry]) => ({
  path,
  component: lazy(() => import(/* @vite-ignore */ entry)),
}))

function App() {
  const [count, setCount] = createSignal(0)
  const Route = useRoutes(solidRoutes)
  return (
    <>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <hr />
      <Route />
      <button onClick={() => setCount(count() + 1)}>{count()}</button>
    </>
  )
}

export default defineLayout({
  render(req) {
    return () => (
      <Router url={req.path}>
        <App />
      </Router>
    )
  },
})
