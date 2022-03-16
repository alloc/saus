import { route } from 'saus'
import pokemonList from '../../data/pokemon.json'
import { scrapedText } from '../state'
import configureHtml from './html'

route('/', () => import('../routes/Home'))

route('/pokemon/:name', () => import('../routes/Pokemon'), {
  paths: () => pokemonList.map(name => name.toLowerCase()),
  include: (_, { name }) => [scrapedText.bind(name)],
})

route(() => import('../routes/NotFound'))

configureHtml({
  cacheAssets: false,
})
