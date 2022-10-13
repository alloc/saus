export const getRawGitHubUrl = (opts: {
  token: string
  repo: string
  branch: string
  file: string
}) =>
  `https://${opts.token}@raw.githubusercontent.com/${opts.repo}/${opts.branch}/${opts.file}`
