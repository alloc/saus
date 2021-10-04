export default () => (
  <>
    <h1>Page not found</h1>
    <a href="#" onClick={e => (e.preventDefault(), history.back())}>
      Go back
    </a>
  </>
)
