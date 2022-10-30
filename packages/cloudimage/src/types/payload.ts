export interface Payload {
  data: Payload.Data
}

export namespace Payload {
  export interface Data {
    aliases: any[]
    jpeg: JPEG
    webp: Webp
    webpPNG: Avif
    svg: SVG
    mapping: Mapping
    elastic: Elastic
    cache: Cache
    restrictions: Restrictions
    choices: Choices
    refreshMasterImages: RefreshMasterImages
    allowedDomains: any[]
    png: PNG
    originProcess: OriginProcess
    originPrefix: OriginPrefix
    originBehavior: OriginBehavior
    avif: Avif
    gif: GIF
    proxyEverythingThatIsNotCloudimageProcessableExtension: number
    rules: Rule[]
    advanced: Advanced
    presets: Preset[]
    cnames: string[]
    cnamesTLSValidation: any[]
    storageProviders: StorageProviders
  }

  export interface Advanced {
    proxyConnstring: string
  }

  export interface Avif {
    enabled: string
  }

  export interface Cache {
    outputMaxAge: number
    outputSMaxAge: number
  }

  export interface Choices {
    defaultRotate: boolean
    defaultSameIfLower: null
    missingImgBehavior: string
    whitelistImgBehavior: string
    whitelistUltrafast: string
  }

  export interface Elastic {
    failoverRetries: null
    failoverOn404: null
  }

  export interface GIF {
    lossyAnimated: boolean
  }

  export interface JPEG {
    quality: number
    interlace: boolean
  }

  export interface Mapping {
    prefGeo: string
    prefHexa: null
  }

  export interface OriginBehavior {
    requestHeaders: Http.RequestHeaders
  }

  export interface Http.RequestHeaders {}

  export interface OriginPrefix {
    method: string
    url: string
  }

  export interface OriginProcess {
    keepExif: boolean
    jpgIcc: JpgIcc
  }

  export interface JpgIcc {
    keep: boolean
    ifBigGoSrgb: IfBigGoSrgb
  }

  export interface IfBigGoSrgb {
    enabled: boolean
    triggerSize: number
  }

  export interface PNG {
    pngLossy: boolean
    quality: number
  }

  export interface Preset {
    name: string
    desc: string
    params: Params
  }

  export interface Params {
    bgBlur?: string
    bgImgFit?: string
    bgOpacity?: string
    func?: string
    h?: string
    q?: string
    w?: string
    blur?: string
    sharp?: string
    orgIfSml?: string
    forceFormat?: string
  }

  export interface RefreshMasterImages {
    enabled: null
    period: number
    method: null
  }

  export interface Restrictions {
    paths: null
  }

  export interface Rule {
    match: string
    comment: string
    params: string
  }

  export interface StorageProviders {
    awsS3: null
    own: any[]
    azureBlob: null
    googleCloud: null
  }

  export interface SVG {
    doNotResize: number
  }

  export interface Webp {
    enabled: string
    convert: boolean
    convertAnimated: boolean
  }
}
