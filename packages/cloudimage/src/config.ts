import { PartialDeep } from 'type-fest'
import { Payload } from './types/payload'

export const configToPayload = (config: Config): PartialDeep<Payload.Data> => ({
  originPrefix: {
    method: 'EVERYTIME',
    url: config.originPrefix || '',
  },
  presets: config.presets?.map(preset => {
    return {
      desc: '',
      ...preset,
      params: imageParamsToPayload(preset.params),
    }
  }),
  choices: {
    missingImgBehavior: config.missingImageBehavior || 'returns_empty_404',
  },
  cache: {
    outputMaxAge: config.caching?.maxAge ?? 2592000,
    outputSMaxAge: config.caching?.cdnMaxAge ?? 31536000,
  },
})

export interface Config {
  originPrefix?: string
  presets?: Preset[]
  missingImageBehavior?: MissingImageBehavior
  caching?: CacheConfig
}

export interface CacheConfig {
  /** @default 2592000 (30 days) */
  maxAge?: number
  /** @default 31536000 (1 year) */
  cdnMaxAge?: number
}

export type MissingImageBehavior =
  | 'default_200'
  | 'returns_200_1x1_gif'
  | 'returns_404'
  | 'returns_empty_404'

export interface Preset {
  name: string
  desc?: string
  params: ImageParams
}

export type ImageFunc =
  | 'fit'
  | 'cover'
  | 'crop'
  | 'cropfit'
  | 'bound'
  | 'boundmin'
  | 'face'
  | 'facehide'

export interface ImageParams {
  func?: ImageFunc
  width?: number
  height?: number
  background?: {
    blurRadius?: number
    /** Between 0 and 1 */
    opacity?: number
  }
  aspectRatio?: number
  crop?: {
    gravity?: 'auto' | 'face'
  }
  blurRadius?: number
  sharpen?: boolean
  neverUpscale?: boolean
  forceFormat?: 'webp' | 'png' | 'jpeg'
  /** Between 1 and 100 */
  quality?: number
}

const imageParamsToPayload = (params: ImageParams) => {
  const payload = {} as Payload.Data['presets'][number]['params']
  if (params.func) {
    payload.func = params.func
  }
  if (params.width !== undefined) {
    payload.w = '' + params.width
  }
  if (params.height !== undefined) {
    payload.h = '' + params.height
  }
  const bg = params.background
  if (bg) {
    payload.bgImgFit = '1'
    if (bg.blurRadius !== undefined) {
      payload.bgBlur = '' + bg.blurRadius
    }
    if (bg.opacity !== undefined) {
      payload.bgOpacity = '' + bg.opacity
    }
  }
  if (params.forceFormat) {
    payload.forceFormat = params.forceFormat
  }
  if (params.quality !== undefined) {
    payload.q = '' + params.quality
  }
  if (params.blurRadius) {
    payload.blur = '' + params.blurRadius
  }
  if (params.sharpen) {
    payload.sharp = '1'
  }
  if (params.neverUpscale) {
    payload.orgIfSml = '1'
  }
  return payload
}
