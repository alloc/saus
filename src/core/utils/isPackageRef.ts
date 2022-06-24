const packageRefRE = /^(\w|@\w)/

/**
 * Assume bare imports are referencing another package, unless
 * they start with "../" (a common alias for local files).
 *
 * Note: This function assumes you're passing a bare import!
 */
export const isPackageRef = (id: string) => packageRefRE.test(id)
