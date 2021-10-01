import { defineRoutes } from 'stite'
import fs from 'fs'

export default defineRoutes({
  '/': () => import('../routes/Home'),
  '/pokemon/:name': {
    import: () => import('../routes/Pokemon'),
    query: () =>
      JSON.parse(fs.readFileSync('./data/pokemon.json', 'utf8')).map(
        (name: string) => name.toLowerCase()
      ) as string[],
  },
  404: () => import('../routes/NotFound'),
})
