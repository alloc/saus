// import type { OutputBundle } from '../bundle'
// import { onDeploy } from '../deploy'

// /**
//  * @experimental
//  * ⚠️ Call this in your deploy file.
//  */
// export function purgeOnDeploy(bundle: OutputBundle) {
//   // TODO: provide the routes whose content hashes have changed
//   return onDeploy(ctx => {
//     const routeEntriesFile = ctx.files.get(`route-entries.json`)
//     if (routeEntriesFile.exists) {
//       const routeEntries: {
//         [route: string]: string
//       } = routeEntriesFile.getData()

//       const purgedRoutes = Object.keys(routeEntries).filter(route => {
//         const oldEntry = routeEntries[route]
//         const entry = bundle.routeEntries[route]
//         return !entry || (oldEntry && entry !== oldEntry)
//       })

//       return ctx.logPlan(`purge ${purgedRoutes.length} routes`, async () => {
//         routeEntriesFile.setData(bundle.routeEntries)
//       })
//     }
//   })
// }
