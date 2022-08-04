export interface GitOrigin {
  url: string
  branch: string
}

export interface GitRepository extends InitConfig {
  origin: GitOrigin
  /**
   * The last pushed HEAD commit.
   *
   * This is an empty string until `gitPush` is called.
   */
  head: string
  /**
   * Equals true if a commit was pushed.
   *
   * Always equals false in a dry run.
   */
  pushed: boolean
}

export interface InitConfig {
  /**
   * Directory path where `.git` lives
   *
   * If no `.git` directory is found, then `git init` is used.
   *
   * This path is relative to the Vite project root.
   */
  root: string
  /**
   * The repository's remote location
   *
   * Can be `"<url>#<branch>"` or an object.
   */
  origin: string | GitOrigin
  /**
   * Use `git reset --hard` if uncommitted changes exist. \
   * When this is false or undefined, `git stash` is used instead.
   */
  hardReset?: boolean
}

export interface PushConfig {
  /**
   * The repository object returned by `gitInit`
   */
  repo: GitRepository
  /**
   * Disable the `git commit` action or override its message.
   */
  commit?: { message?: string } | false
}
