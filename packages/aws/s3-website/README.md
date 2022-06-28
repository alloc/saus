# @saus/aws-s3-website

TODO

## Caching Tips

- **Avoid Breaking The Cache**

  - Include `Vary: User-Agent` if your response depends on CloudFront device headers, like `CloudFront-Is-Mobile-Viewer`.

  - Include `Cache-Control: no-cache` if your response is using the `Set-Cookie` header.

  - Include `ETag` and/or `Last-Modified` headers in your response. This allows CloudFront to avoid hitting the origin server when the cache is hit with `If-NoneMatch` or `If-Modified-Since` request headers.

- **Caching By Language Preference**

  - Instead of using the `Accept-Language` request header, we recommend using a URL prefix like `/en/` to determine which language is preferred. This avoids the potential for duplicate responses being stored in the edge cache.
