import { BASE_URL } from './baseUrl'

/** Equals true if the current URL is a debug page */
export const isDebug = BASE_URL !== import.meta.env.BASE_URL
