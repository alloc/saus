import { route } from 'saus'
import pokemonList from '../../data/pokemon.json'

route('/', () => import('../routes/Home'))

route('/pokemon/:name', () => import('../routes/Pokemon'), {
  paths: () => pokemonList.map(name => name.toLowerCase()),
})

route(() => import('../routes/NotFound'))
