import http from 'http'

export interface HttpOptions extends http.RequestOptions {
  hash?: string
  search?: string
  pathname?: string
  href?: string
}
