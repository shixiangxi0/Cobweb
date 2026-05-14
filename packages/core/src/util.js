/**
 * util.js — internal helpers. No side-effects, no imports.
 */

/**
 * Recursively replace null/undefined with undefined throughout an object tree.
 *
 * wasmoon crashes when a JS null reaches the Lua boundary (null.then exception).
 * Call this on any value returned by registry.get() before handing it to Lua.
 *
 * Uses a WeakSet to safely handle objects with shared references (no infinite loops).
 *
 * @param {any} v
 * @returns {any}  null/undefined → undefined, objects have nulls stripped recursively
 */
export function luaSafe(v, seen = new WeakSet()) {
  if (v === null || v === undefined) return undefined
  if (typeof v !== 'object') return v
  if (seen.has(v)) return v
  seen.add(v)
  let result
  if (Array.isArray(v)) {
    result = v.map(x => luaSafe(x, seen))
  } else {
    result = {}
    for (const [k, val] of Object.entries(v)) {
      const safe = luaSafe(val, seen)
      if (safe !== undefined) result[k] = safe
    }
  }
  seen.delete(v)
  return result
}

/**
 * Write a value at a dot-delimited path inside a plain object.
 * Intermediate objects are created as needed.
 * value === null  →  delete the terminal key.
 *
 * NOTE: path segments must not themselves contain dots.
 *
 * @param {object} obj
 * @param {string} path   e.g. 'entities.player.hp'
 * @param {any}    value  null deletes the key
 */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor'])

export function setPath(obj, path, value) {
  const keys = path.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (FORBIDDEN_SEGMENTS.has(k)) {
      throw new Error(`[setPath] forbidden path segment: ${k}`)
    }
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  const last = keys[keys.length - 1]
  if (FORBIDDEN_SEGMENTS.has(last)) {
    throw new Error(`[setPath] forbidden path segment: ${last}`)
  }
  if (value === null || value === undefined) {
    delete cur[last]
  } else {
    cur[last] = value
  }
}

/**
 * Deep-clone a value using the platform structuredClone.
 * Named alias so callers are insulated from a future polyfill swap.
 *
 * @template T
 * @param {T} v
 * @returns {T}
 */
export const deepClone = v => structuredClone(v)
