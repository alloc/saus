# saus/paths

Access an array of known URLs generated from `route` calls.

If you've defined a default route, the array will contain a `"default"` string. You should check for this string and handle it differently than other paths. For example, you might render the `/404` URL instead, and serve the generated HTML from `/404.html` (which static site hosts like GitHub Pages may use as the fallback page when a URL is not found).
