import { defineRoutes } from 'saus'
import pokemonList from '../../data/pokemon.json'

defineRoutes({
  '/': () => import('../routes/Home'),
  '/pokemon/:name': {
    load: () => import('../routes/Pokemon'),
    query() {
      return pokemonList.map(name => [name.toLowerCase()])
    },
  },
  default: () => import('../routes/NotFound'),
})
