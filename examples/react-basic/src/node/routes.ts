import { resolveHtmlImports, route, transformHtml } from 'saus'
import pokemonList from '../../data/pokemon.json'

route('/', () => import('../routes/Home'))

route('/pokemon/:name', () => import('../routes/Pokemon'), {
  paths: () => pokemonList.map(name => name.toLowerCase()),
})

route(() => import('../routes/NotFound'))

// transformHtml({
//   open(path) {
//     console.log('open: %O', path.toString())
//   },
// })

// resolveHtmlImports((id, importer, state) => {
//   console.log('resolve: %O', state.tag.toString())
// })
