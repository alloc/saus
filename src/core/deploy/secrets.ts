import { Promisable } from '../../utils/types'

export class SecretHub {
  private _values: Record<string, any> = {}
  private _sources: SecretSource[] = []

  toJSON() {
    return this._values
  }

  /** Set secrets manually. */
  set(secrets: Record<string, any>) {
    Object.assign(this._values, secrets)
  }

  /** Add a source to load secrets from. */
  addSource(source: SecretSource) {
    this._sources.push(source)
  }

  async load() {
    const loaded = { ...this._values }
    for (const source of this._sources) {
      source.loaded = await source.load()
      Object.assign(loaded, source.loaded)
    }
    return loaded
  }
}

export interface SecretSource {
  loaded?: Record<string, any>
  load: () => Promisable<Record<string, any>>
}
