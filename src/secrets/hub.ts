import { defer } from '@/utils/defer'
import type { DeployContext } from '../deploy/context'
import { kSecretDefinition } from './symbols'
import type {
  DefinedSecrets,
  MutableSecretSource,
  SecretMap,
  SecretSource,
} from './types'

export class SecretHub {
  private _sources: SecretSource[] = []
  private _secrets: SecretMap = {}
  private _loaded = defer<Set<string> | undefined>()
  private _loading = false
  private _imported = new Set<Function>()
  private _defined = new Map<Function, DefinedSecrets>()
  private _adopted = new Map<Function, Function[]>()

  constructor(private _context: DeployContext) {}

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
    const ensureSecretsExist = (fn: Function) => {
      const secrets = this._defined.get(fn)
      if (secrets) {
        Object.entries(secrets[kSecretDefinition]).forEach(([alias, name]) => {
          const secret = this._secrets[name]
          if (secret) {
            secrets[alias] = secret
          } else {
            missing.add(name)
          }
        })
      }
    }
    for (const fn of this._imported) {
      const adopted = this._adopted.get(fn)
      adopted?.forEach(ensureSecretsExist)
      ensureSecretsExist(fn)
    }
    if (missing.size) {
      if (!silent) {
        const { logger } = this._context
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
