/**
 * rng.js — deterministic random-number utilities.
 *
 * Pure functions: no state, no side-effects, no dependency on the engine.
 * Same seed → same results, every time.
 */

export function hashString(str) {
  let hash = 0
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) || 1
}

export function random(seed, count, min, max) {
  let current = hashString(seed) + 48271
  const results = []
  const range = Math.trunc(Number(max)) - Math.trunc(Number(min)) + 1
  for (let i = 0; i < count; i++) {
    current = (current * 48271) % 2147483647
    results.push(Math.floor(((current - 1) / 2147483646) * range) + Math.trunc(Number(min)))
  }
  return results
}

export function shuffle(seed, arr) {
  if (!Array.isArray(arr) || arr.length <= 1) return [...(arr ?? [])]
  const randoms = random(seed, arr.length, 1, arr.length)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor((randoms[i - 1] - 1) / arr.length * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}
