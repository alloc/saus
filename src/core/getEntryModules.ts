import { dedupe } from '@utils/dedupe'
import { SausContext } from './context'

export async function getEntryModules(context: SausContext) {
  const routes = [...context.routes]
  context.defaultRoute && routes.push(context.defaultRoute)
  context.catchRoute && routes.push(context.catchRoute)

  return (
    await Promise.all(
      dedupe(
        routes
          .map(route => [
            route.moduleId,
            route.layoutEntry || context.defaultLayout.id,
          ])
          .flat()
      ).map(async moduleId => {
        if (moduleId) {
          const resolved = await context.resolveId(moduleId)
          return resolved?.id
        }
      })
    )
  ).filter(Boolean) as string[]
}
