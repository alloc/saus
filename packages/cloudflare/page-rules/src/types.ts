export type DnsRecordList<Props extends object = {}> = (Props &
  (DnsRecord | DnsPrioritizedRecord))[]

export interface DnsRecord {
  type: DnsRecordType
  /**
   * Max length is 255
   * @example "example.com"
   */
  name: '@' | string
  /**
   * @example "127.0.0.1"
   */
  content: string
  /**
   * Time to live (in seconds) \
   * Must be between 60 and 86400, or 1 for automatic.
   * @default 1
   */
  ttl?: number
  /**
   * Should the Cloudflare CDN be used? \
   * Must be true for Cloudflare workers to be triggered.
   */
  proxied?: boolean
}

export interface DnsPrioritizedRecord extends DnsRecord {
  type: 'MX' | 'SRV' | 'URI'
  /** Must be between 0 and 65535. Lower values are preferred. */
  priority?: number
}

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'CNAME'
  | 'HTTPS'
  | 'TXT'
  | 'SRV'
  | 'LOC'
  | 'MX'
  | 'NS'
  | 'CERT'
  | 'DNSKEY'
  | 'DS'
  | 'NAPTR'
  | 'SMIMEA'
  | 'SSHFP'
  | 'SVCB'
  | 'TLSA'
  | 'URI'
