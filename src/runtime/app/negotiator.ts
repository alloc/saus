/**
 * negotiator
 * Copyright(c) 2012 Isaac Z. Schlueter
 * Copyright(c) 2014 Federico Romero
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * Copyright(c) 2022 Alec Larson
 * MIT Licensed
 */

import { toArray } from '@utils/array'

const simpleMediaTypeRegExp = /^\s*([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/

/**
 * Parse the Accept header.
 */
function parseAccept(accept: string) {
  const accepts: MediaType[] = []

  splitMediaTypes(accept).forEach((part, i) => {
    const mediaType = parseMediaType(part.trim(), i)
    if (mediaType) {
      accepts.push(mediaType)
    }
  })

  return accepts
}

export interface MediaType {
  type: string
  subtype: string
  params: Record<string, string>
  q: number
  i: number
}

/**
 * Parse a media type from the Accept header.
 */
function parseMediaType(str: string, i: number) {
  const match = simpleMediaTypeRegExp.exec(str)
  if (!match) {
    return null
  }

  const type = match[1]
  const subtype = match[2]
  const params = Object.create(null)
  let q = 1

  if (match[3]) {
    const pairs = splitParameters(match[3]).map(splitKeyValuePair)

    for (let j = 0; j < pairs.length; j++) {
      let [key, value] = pairs[j]
      key = key.toLowerCase()

      // get the value, unwrapping quotes
      if (value && value[0] === '"' && value[value.length - 1] === '"') {
        value = value.substr(1, value.length - 2)
      }

      if (key === 'q') {
        q = value ? parseFloat(value) : 0
        break
      }

      // store parameter
      params[key] = value
    }
  }

  return {
    type: type,
    subtype: subtype,
    params: params,
    q: q,
    i: i,
  }
}

interface MediaPriority {
  i: number
  o: number
  q: number
  s: number
}

/**
 * Get the priority of a media type.
 */
function getMediaTypePriority(
  type: string,
  accepted: MediaType[],
  index: number
) {
  let priority: MediaPriority = {
    i: index,
    o: -1,
    q: 0,
    s: 0,
  }

  for (let i = 0; i < accepted.length; i++) {
    const spec = specify(type, accepted[i], index)
    if (
      spec &&
      (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0
    ) {
      priority = spec
    }
  }

  return priority
}

/**
 * Get the specificity of the media type.
 * @private
 */
function specify(
  type: string,
  spec: MediaType,
  index: number
): MediaPriority | null {
  const p = parseMediaType(type, index)
  if (!p) {
    return null
  }

  let s = 0

  if (spec.type.toLowerCase() == p.type.toLowerCase()) {
    s |= 4
  } else if (spec.type != '*') {
    return null
  }

  if (spec.subtype.toLowerCase() == p.subtype.toLowerCase()) {
    s |= 2
  } else if (spec.subtype != '*') {
    return null
  }

  const keys = Object.keys(spec.params)
  if (keys.length > 0) {
    const allKeysMatch = keys.every(
      k =>
        spec.params[k] == '*' ||
        (spec.params[k] || '').toLowerCase() ==
          (p.params[k] || '').toLowerCase()
    )
    if (!allKeysMatch) {
      return null
    }
    s |= 1
  }

  return {
    i: index,
    o: spec.i ?? -1,
    q: spec.q,
    s: s,
  }
}

/**
 * Get the preferred media types from an Accept header.
 */
export function createNegotiator(acceptHeader: string | string[] | undefined) {
  const [accept] = toArray(acceptHeader)
  if (!accept || accept === '*/*') {
    return null
  }
  const accepted = parseAccept(accept)
  return (provided: string[]) => {
    const priorities = provided.map((type, index) => {
      return getMediaTypePriority(type, accepted, index)
    })

    // sorted list of accepted types
    return priorities
      .filter(isQuality)
      .sort(compareSpecs)
      .map(function getType(priority) {
        return provided[priorities.indexOf(priority)]
      })
  }
}

/**
 * Compare two specs.
 */
function compareSpecs(a: MediaPriority, b: MediaPriority) {
  return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0
}

/**
 * Check if a spec has any quality.
 * @private
 */
function isQuality(spec: MediaPriority | MediaType) {
  return spec.q > 0
}

/**
 * Count the number of quotes in a string.
 */

function quoteCount(str: string) {
  let count = 0
  let index = 0

  while ((index = str.indexOf('"', index)) !== -1) {
    count++
    index++
  }

  return count
}

/**
 * Split a key value pair.
 */

function splitKeyValuePair(str: string) {
  const index = str.indexOf('=')
  let key
  let val

  if (index === -1) {
    key = str
  } else {
    key = str.slice(0, index)
    val = str.slice(index + 1)
  }

  return [key, val] as const
}

/**
 * Split an Accept header into media types.
 */
function splitMediaTypes(accept: string) {
  const accepts = accept.split(',')

  let j = 0
  for (let i = 1; i < accepts.length; i++) {
    if (quoteCount(accepts[j]) % 2 == 0) {
      accepts[++j] = accepts[i]
    } else {
      accepts[j] += ',' + accepts[i]
    }
  }

  // trim accepts
  accepts.length = j + 1

  return accepts
}

/**
 * Split a string of parameters.
 */
function splitParameters(str: string) {
  const parameters = str.split(';')

  let j = 0
  for (let i = 1; i < parameters.length; i++) {
    if (quoteCount(parameters[j]) % 2 == 0) {
      parameters[++j] = parameters[i]
    } else {
      parameters[j] += ';' + parameters[i]
    }
  }

  // trim parameters
  parameters.length = j + 1

  for (let i = 0; i < parameters.length; i++) {
    parameters[i] = parameters[i].trim()
  }

  return parameters
}
