import { toExpirationTime } from '../cache/expiration'
import { App, LoadedStateModule, RenderedFile } from './types'

export function collectStateFiles(
  files: RenderedFile[],
  loadedModules: LoadedStateModule[],
  app: App
): void {
  const { stateModuleBase } = app.config
  for (const loaded of loadedModules) {
    const { key, name } = loaded.stateModule
    files.push({
      id: stateModuleBase + key + '.js',
      get data() {
        return app.renderStateModule(name, loaded)
      },
      mime: 'application/javascript',
      expiresAt: toExpirationTime(loaded, undefined),
      wasCached: loaded.wasCached,
    })
  }
}
