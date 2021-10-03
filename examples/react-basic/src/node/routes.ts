import { defineRoutes } from 'saus'
import fs from 'fs'

export default defineRoutes({
  '/': () => import('../routes/Home'),
  '/pokemon/:name': {
    load: () => import('../routes/Pokemon'),
    query() {
      const pokemon: string[] = JSON.parse(
        fs.readFileSync('./data/pokemon.json', 'utf8')
      )
      return pokemon.map(name => [name.toLowerCase()])
    },
  },
  default: () => import('../routes/NotFound'),
})
