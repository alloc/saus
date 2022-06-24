# @saus/secrets

## Save encrypted secrets to git

The `useGitSecrets` function will store your secrets in a AES-256 encrypted file
and push it to the `deployed` branch in your origin repository.

## Load secrets at runtime

Your SSR bundle can load secrets from GitHub. This is useful when you have secrets
shared between deployment and your production server.

The secrets are loaded into the `deployedEnv` object (exported by `saus/core`), so
other modules can access them transparently.

```ts
// ./src/routes.ts
import { loadGitHubSecrets } from '@saus/secrets'
import { deployedEnv } from 'saus/core'

// Before using packages that rely on `deployedEnv` object.
await loadGitHubSecrets(repoId, authToken, password)

console.log(deployedEnv)
```

- The `repoId` argument is the GitHub slug for your project repository.
- The `authToken` argument is a personal GitHub access token.
- The `password` argument is whatever you used when running the `saus secrets add`
  or `saus deploy` command. This password should be stored securely. How you do that
  depends on your webhost, but many let you set environment variables from their
  admin UI.
