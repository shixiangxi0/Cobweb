/**
 * Registry.js — state tree + event pipeline storage.
 *
 * Single responsibility: pure data structure.
 * No business logic, no game concepts, no side-effects beyond mutations of its
 * own fields.
 *
 * Two independent storage areas:
 *   _store     — the application state tree, exposed via getState()
 *   _bindings  — a flat map nested inside _store._bindings (part of the state,
 *                persisted in saves). Managed via setBinding/getBindings so that
 *                bind keys containing dots ('actors.e1:shield') are handled safely
 *                without conflicting with the dot-path parser used by set/get.
 */
import { setPath, deepClone } from './util.js'

// ─── Hooks normalization (merged from hooks.js) ────────────────────────────

const EVENT_PREFIX = 'event:'

function _normalizeMatch(key, match) {
  if (match == null) return null
  if (typeof match !== 'object' || Array.isArray(match)) {
    throw new Error(`[hooks] "${key}.match" must be an object mapping payload keys to ctx keys`)
  }

  const entries = Object.entries(match)
  if (entries.length === 0) return null

  const normalized = {}
  for (const [payloadKey, ctxKey] of entries) {
    if (typeof payloadKey !== 'string' || payloadKey.length === 0) {
      throw new Error(`[hooks] "${key}.match" payload keys must be non-empty strings`)
    }
    if (typeof ctxKey !== 'string' || ctxKey.length === 0) {
      throw new Error(`[hooks] "${key}.match.${payloadKey}" must be a non-empty ctx key string`)
    }
    normalized[payloadKey] = ctxKey
  }
  return normalized
}

function _normalizeHookValue(key, value) {
  if (typeof value === 'string') return { script: value, order: 0, match: null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[hooks] "${key}" must be a script string or { script, order?, match? }`)
  }
  if (typeof value.script !== 'string') {
    throw new Error(`[hooks] "${key}.script" must be a string`)
  }
  if (value.order != null && !Number.isFinite(value.order)) {
    throw new Error(`[hooks] "${key}.order" must be a finite number`)
  }
  return {
    script: value.script,
    order:  value.order ?? 0,
    match:  _normalizeMatch(key, value.match),
  }
}

function _getEventHooks(def) {
  const hooks = []
  const map = def?.hooks
  if (!map) return hooks
  if (typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('[hooks] def.hooks must be an object')
  }

  for (const [key, raw] of Object.entries(map)) {
    const base = _normalizeHookValue(key, raw)
    if (!key.startsWith(EVENT_PREFIX)) {
      throw new Error(`[hooks] unsupported hook key "${key}" — expected "event:<name>"`)
    }

    const name = key.slice(EVENT_PREFIX.length)
    if (!name) throw new Error(`[hooks] "${key}" must include an event name after "event:"`)
    hooks.push({
      name,
      order:  base.order,
      script: base.script,
      match:  base.match,
    })
  }

  return hooks
}

export class Registry {
  constructor() {
    this._store     = {}
    this._patches   = []
    this._pipelines = new Map()
  }

  // ─── State tree ────────────────────────────────────────────────────────────

  get(path) {
    const keys = path.split('.')
    for (const k of keys) {
      if (k === '__proto__' || k === 'constructor') {
        throw new Error(`[Registry.get] forbidden path segment: ${k}`)
      }
    }
    return keys.reduce((o, k) => (o != null ? o[k] : undefined), this._store)
  }

  set(path, value) {
    const before = this.get(path) ?? null
    const after  = value ?? null
    if (before === after) return
    const stored = after === null ? null : (typeof after === 'object' ? deepClone(after) : after)
    setPath(this._store, path, stored)
    this._patches.push({
      path,
      before: before === null || before === undefined ? null : (typeof before === 'object' ? deepClone(before) : before),
      after: stored === null ? null : (typeof stored === 'object' ? deepClone(stored) : stored),
    })
  }

  flushPatches() {
    const result = this._patches.slice()
    this._patches.length = 0
    return result
  }

  snapshot() {
    return {
      store: deepClone(this._store),
      patches: deepClone(this._patches),
      pipelines: deepClone([...this._pipelines.entries()]),
    }
  }

  restore(snapshot = {}) {
    this._store = deepClone(snapshot.store ?? {})
    this._patches = deepClone(snapshot.patches ?? [])
    this._pipelines = new Map(deepClone(snapshot.pipelines ?? []))
  }

  peekState() { return this._store }
  getState() { return deepClone(this._store) }

  resetState(nextStore = {}) {
    this._store = deepClone(nextStore)
    this._patches.length = 0
  }

  // ─── _bindings (direct map, key-safe) ─────────────────────────────────────

  setBinding(key, descriptor) {
    const bindings = this._store._bindings ?? null
    const before = bindings?.[key] ?? null
    const after  = descriptor ?? null
    if (before === after) return

    const nextDescriptor = after === null ? null : deepClone(after)

    if (!this._store._bindings) this._store._bindings = {}
    if (nextDescriptor === null) {
      delete this._store._bindings[key]
      if (Object.keys(this._store._bindings).length === 0) {
        delete this._store._bindings
      }
    } else {
      this._store._bindings[key] = nextDescriptor
    }
    this._patches.push({
      path: `_bindings.${key}`,
      before: before === null || before === undefined ? null : (typeof before === 'object' ? deepClone(before) : before),
      after: nextDescriptor === null ? null : (typeof nextDescriptor === 'object' ? deepClone(nextDescriptor) : nextDescriptor),
    })
  }

  getBindings() { return this._store._bindings ?? {} }

  // ─── Pipelines ─────────────────────────────────────────────────────────────

  definePipeline(event, { action } = {}) {
    if (this._pipelines.has(event)) {
      throw new Error(`[Registry] definePipeline: event "${event}" is already declared`)
    }
    this._pipelines.set(event, {
      action:   action ?? event.toUpperCase().replace(/:/g, '_'),
      handlers: [],
    })
  }

  register(moduleDef, { registeredBy, ctx = {}, slot = null, defaultMatch = null } = {}) {
    for (const { event, handler } of this._prepareRegistration(moduleDef, { registeredBy, ctx, slot, defaultMatch })) {
      const pipeline = this._pipelines.get(event)
      this._insertSorted(pipeline.handlers, handler)
    }
  }

  unregister(key) {
    for (const p of this._pipelines.values())
      p.handlers = p.handlers.filter(h => h.registeredBy !== key)
  }

  getPipeline(event) { return this._pipelines.get(event) ?? null }

  // ─── Private ───────────────────────────────────────────────────────────────

  _insertSorted(arr, item) {
    let lo = 0, hi = arr.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const current = arr[mid]
      const sameOrder = current.order === item.order
      const bothSlotted = sameOrder && current.slot != null && item.slot != null

      if (current.order > item.order) {
        lo = mid + 1
      } else if (current.order < item.order) {
        hi = mid
      } else if (bothSlotted && current.slot < item.slot) {
        lo = mid + 1
      } else if (bothSlotted && current.slot > item.slot) {
        hi = mid
      } else {
        lo = mid + 1
      }
    }
    arr.splice(lo, 0, item)
  }

  _prepareRegistration(moduleDef, { registeredBy, ctx = {}, slot = null, defaultMatch = null } = {}) {
    if (!moduleDef?.id) throw new Error('[Registry] register: moduleDef.id is required')
    const owner = registeredBy ?? moduleDef.id

    return _getEventHooks(moduleDef).map((t) => ({
      event: t.name,
      handler: this._normalizeHandler(t.name, {
        script: t.script,
        order: t.order ?? 0,
        slot,
        registeredBy: owner,
        moduleId: moduleDef.id,
        ctx,
        match: t.match ?? defaultMatch,
      }),
    }))
  }

  _normalizeHandler(event, { script, order = 0, slot = null, registeredBy, moduleId, ctx = {}, match = null } = {}) {
    const pipeline = this._pipelines.get(event)
    if (!pipeline) {
      const moduleLabel = moduleId ? ` (module: "${moduleId}")` : ''
      throw new Error(`[Registry] addHandler: undeclared event "${event}"${moduleLabel} — call definePipeline first`)
    }
    if (typeof script !== 'string') {
      throw new Error(`[Registry] addHandler: script must be a string (event: "${event}")`)
    }

    return { script, order, slot, registeredBy, moduleId, ctx, match }
  }
}

// ─── Type documentation (JSDoc only, no runtime overhead) ──────────────────

/**
 * @typedef {{ path: string, before: any, after: any }} Patch
 * @typedef {{ script: string, order: number, slot?: number | null, registeredBy: string, moduleId?: string, ctx?: object, match?: object | null }} Handler
 * @typedef {{ action: string, handlers: Handler[] }} Pipeline
 */
