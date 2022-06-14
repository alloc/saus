import { Promisable } from '../../utils/types'
import { getDeployContext } from '../deploy'

/** This can be extended by plugins via interface merging. */
export interface KnownSecrets {}

export type SecretMap = Record<string, any> & KnownSecrets

export class SecretHub {
  private _sources: SecretSource[] = []
  private _secrets: SecretMap = {}
  private _expected = new Set<string>()

  toJSON(): Readonly<SecretMap> {
    return this._secrets
  }

  /** Get the list of mutable secret sources. */
  getMutableSources(): MutableSecretSource[] {
    return this._sources.filter(s => s.set) as any
  }

  /** Set secrets manually. Fine for testing purposes. */
  set(secrets: SecretMap) {
    Object.assign(this._secrets, secrets)
  }

  /** Throw if any of these secret names are not defined. */
  expect(names: string[]) {
    names.forEach(name => this._expected.add(name))
  }

  /** Add a source to load secrets from. */
  addSource(source: SecretSource) {
    this._sources.push(source)
  }

  /**
   * Load secrets from the added sources. \
   * Missing secrets are returned as a set of names.
   */
  async load(silent?: boolean) {
    const expected = new Set(this._expected)
    for (const source of this._sources) {
      source.loaded = await source.load()
      for (const [name, secret] of Object.entries(source.loaded)) {
        if (!secret) continue
        this._secrets[name] = secret
        expected.delete(name)
      }
    }
    if (expected.size) {
      if (!silent) {
        const { logger } = getDeployContext()
        logger.warn(
          'Secrets are missing:' +
            Array.from(expected, name => '\n  ‣ ' + name).slice(0, 5) +
            (expected.size > 5 ? `\n  +${expected.size - 5} more` : '')
        )
      }
      return expected
    }
  }
}

export interface SecretSource {
  name: string
  loaded?: Record<string, any>
  load: () => Promisable<Record<string, any>>
  set?: (secrets: SecretMap, replace?: boolean) => Promisable<void>
}

export interface MutableSecretSource extends SecretSource {
  set: (secrets: SecretMap, replace?: boolean) => Promisable<void>
}
