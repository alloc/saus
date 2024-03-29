import merge from 'lodash.merge'
import { defineDeployHook } from 'saus/deploy'
import { http } from 'saus/http'
import { rewriteKeys } from 'saus/utils/keys'
import { murmurHash } from 'saus/utils/murmur3'
import { Config, configToPayload } from './config'
import secrets from './secrets'
import { snakeCase } from './snakeCase'
import { LoginResponse } from './types/login'
import { Payload } from './types/payload'
import { SessionResponse } from './types/session'

export default defineDeployHook(ctx => {
  let auth: Auth
  let data: Partial<Payload.Data>
  return {
    name: '@saus/cloudimage',
    async pull(config: Config) {
      auth = await login()
      data = rewriteKeys(
        configToPayload(config),
        snakeCase
      ) as Partial<Payload.Data>

      return {
        token: auth.projectToken,
        configHash: murmurHash(JSON.stringify(data)),
      }
    },
    identify: ({ token }) => ({ token }),
    spawn: async config => {
      if (ctx.dryRun) return

      const prevData = await getConfiguration(auth)
      const nextData = {
        ...merge(merge({}, prevData), data),
        // These options are never merged.
        presets: data.presets || [],
      }

      await setConfiguration(auth, nextData)
      ctx.logSuccess('Cloudimage settings were updated!')

      return async () => {
        await setConfiguration(auth, prevData)
      }
    },
    update(config, _, onRevert) {
      return this.spawn(config, onRevert)
    },
    kill: config => {
      if (!ctx.dryRun)
        ctx.logger.warnOnce(
          'Beware: @saus/cloudimage was removed from your deployment file,\n' +
            'but the Cloudimage CDN is still charging you for cached files.'
        )
    },
  }
})

const adminBase = 'https://admin.cloudimage.io/api'

async function login() {
  const resp = await http.post('/login', {
    allowBadStatus: true,
    base: adminBase,
    body: {
      json: {
        login: secrets,
        meta: { track_c: '', track_l: null },
      },
    },
  })

  const { status, session_uuid, msg } = resp.toJSON() as LoginResponse

  if (status !== 'success') {
    throw Error('Login failed: ' + msg)
  }

  return getSession(session_uuid)
}

async function getSession(id: string) {
  const resp = await http('get', `/session/${id}`, {
    base: adminBase,
  })

  const { session_project, session_company } = resp.toJSON() as SessionResponse

  return {
    sessionId: id,
    projectId: session_project.uuid,
    projectToken: session_project.name,
    companyId: session_company.uuid,
  }
}

type Auth = Awaited<ReturnType<typeof login>>

async function getConfiguration(auth: Auth): Promise<Payload.Data> {
  const resp = await http('get', `/project/${auth.projectId}/data`, {
    base: adminBase,
    headers: {
      'x-company-token': auth.companyId,
      'x-project-token': auth.projectId,
      'x-session-token': auth.sessionId,
      'x-version': '2018_R2',
    },
  })
  return resp.toJSON().data
}

async function setConfiguration(auth: Auth, nextData: Payload.Data) {
  const resp = await http('put', `/project/${auth.projectId}/data`, {
    base: adminBase,
    headers: {
      'x-company-token': auth.companyId,
      'x-project-token': auth.projectId,
      'x-session-token': auth.sessionId,
      'x-version': '2018_R2',
    },
    body: {
      json: { data: nextData },
    },
  })

  const { status, ...props } = resp.toJSON()
  if (status !== 'success') {
    throw Object.assign(Error('Failed to update Cloudimage settings'), props)
  }
}
