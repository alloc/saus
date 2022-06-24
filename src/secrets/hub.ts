import { defer } from '@/utils/defer'
import { getDeployContext } from '../deploy/context'
import { MutableSecretSource, SecretMap, SecretSource } from './types'

export class SecretHub {
  private _sources: SecretSource[] = []
  private _secrets: SecretMap = {}
  private _expected = new Set<string>()
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
  expect(expected: string[]): Promise<string[]>
  expect<T extends Record<string, string>>(
    expected: T
  ): Promise<{ [P in keyof T]: string }>
  async expect(expected: string[] | Record<string, string>) {
    const names = Array.isArray(expected) ? expected : Object.values(expected)
    names.forEach(name => this._expected.add(name))
    await this._loaded
    const values = names.map(name => {
      const secret = this._secrets[name]
      if (!secret) {
        throw Error(`Secret not found: ${name}`)
      }
      return secret
    })
    if (Array.isArray(expected)) {
      return values
    }
    return Object.keys(expected).reduce((secrets, key, i) => {
      secrets[key] = values[i]
      return secrets
    }, {} as any)
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
        if (secret) this._secrets[name] = secret
      }
    }
    const missing = new Set<string>()
    for (const name of this._expected) {
      if (!this._secrets[name]) {
        missing.add(name)
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
