# @saus/aws-s3-website

TODO

Note that only GET, HEAD, and OPTIONS requests are supported for your Saus application. \
To track this limitation, see [this unanswered StackOverflow question](https://stackoverflow.com/questions/70512096/aws-cloudfront-origin-groups-cannot-include-post-put-patch-or-delete-for-a-c).

## Custom Domain

In order for CloudFront to allow requests through your TLD (defined with the `domain` option), you need to manually request a SSL certificate with [AWS Certificate Manager](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates/request), validate it with DNS or email, and set the `acm.certificateArn` option to its ARN.

## Caching Tips

- **Avoid Breaking The Cache**

  - Include `Vary: User-Agent` if your response depends on CloudFront device headers, like `CloudFront-Is-Mobile-Viewer`.

  - Include `Cache-Control: no-cache` if your response is using the `Set-Cookie` header.

  - Include `ETag` and/or `Last-Modified` headers in your response. This allows CloudFront to avoid hitting the origin server when the cache is hit with `If-NoneMatch` or `If-Modified-Since` request headers.

- **Caching By Language Preference**

  - Instead of using the `Accept-Language` request header, we recommend using a URL prefix like `/en/` to determine which language is preferred. This avoids the potential for duplicate responses being stored in the edge cache.
