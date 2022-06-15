import { defer } from '../../utils/defer'
import { Promisable } from '../../utils/types'
import { getDeployContext } from '../deploy'

/** This can be extended by plugins via interface merging. */
export interface KnownSecrets {}

export type SecretMap = Record<string, any> & KnownSecrets

type ExpectedSecrets = [readonly string[], (secrets: string[]) => void]

export class SecretHub {
  private _sources: SecretSource[] = []
  private _secrets: SecretMap = {}
  private _expected: ExpectedSecrets[] = []
  private _loaded = defer<Set<string> | undefined>()
  private _loading = false

  /** Get the list of mutable secret sources. */
  getMutableSources(): MutableSecretSource[] {
    return this._sources.filter(s => s.set) as any
  }

  async get(names: readonly string[]) {
    await this._loaded
    return names.map(name => this._secrets[name] as string | undefined)
  }

  /** Set secrets manually. Fine for testing purposes. */
  set(secrets: SecretMap) {
    Object.assign(this._secrets, secrets)
  }

  /** Throw if any of these secret names are not defined. */
  expect(names: readonly string[]) {
    if (this._loaded.settled) {
      return this._loaded.then(() => {
        return names.map(name => {
          const secret = this._secrets[name]
          if (!secret) {
            throw Error(`Secret not found: ${name}`)
          }
          return secret
        })
      })
    } else {
      const { promise, resolve } = defer<string[]>()
      this._expected.push([names, resolve])
      return promise
    }
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
    if (this._loaded.settled || this._loading) {
      return this._loaded.promise
    }
    this._loading = true
    for (const source of this._sources) {
      source.loaded = await source.load()
      for (const [name, secret] of Object.entries(source.loaded)) {
        if (!secret) continue
        this._secrets[name] = secret
      }
    }
    const missing = new Set<string>()
    for (const [expected, resolve] of this._expected) {
      let failed = false
      const secrets = expected.map(name => {
        const secret = this._secrets[name]
        if (!secret) {
          failed = true
          missing.add(name)
        }
        return secret
      })
      if (!failed) {
        resolve(secrets)
      }
    }
    if (missing.size) {
      if (!silent) {
        const { logger } = getDeployContext()
        logger.warn(
          'Secrets are missing:' +
            Array.from(missing, name => '\n  ‣ ' + name).slice(0, 5) +
            (missing.size > 5 ? `\n  +${missing.size - 5} more` : '')
        )
      }
      this._loaded.resolve(missing)
    } else {
      this._loaded.resolve()
    }
    this._loading = false
    return this._loaded.promise
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
