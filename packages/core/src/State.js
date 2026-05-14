/**
 * State.js — the State API shared by JS game code and Lua handler scripts.
 *
 * createState() assembles the runtime State primitives into a plain object.
 * Engine.js injects this object into the Lua VM as the global `State`, and also
 * returns it as `engine.state` for JS callers.
 *
 * bind / unbind — dynamic binding protocol
 * ─────────────────────────────────────────
 * A "dynamic binding" is how an entity acquires a behaviour at runtime.
 * Example: when a status is applied to actor 'p1', the game layer calls
 *   State.bind({ key: 'p1:shield', kind: 'status', id: 'shield', ctx: { self: 'p1' } })
 * This:
 *   1. Looks up allDefs['status']['shield'] (the module definition object)
 *   2. Registers its event hooks into the relevant pipelines under key 'p1:shield'
 *   3. Writes the binding descriptor into _store._bindings['p1:shield']
 *      (via Registry.setBinding, which avoids dot-path parsing issues with
 *       keys that themselves contain dots)
 *
 * The self-recording in step 3 is what makes load() automatic: engine.load(store)
 * iterates store._bindings and replays every bind call without any game-layer help.
 */
import { deepClone, luaSafe } from './util.js'

function mergeStringListMap(current, next) {
  const merged = deepClone(current)
  for (const [name, rawList] of Object.entries(next)) {
    if (!Array.isArray(rawList)) continue
    const existing = new Set(merged[name] ?? [])
    for (const entry of rawList) {
      if (typeof entry === 'string' && entry.length > 0 && !existing.has(entry)) {
        existing.add(entry)
        merged[name] = merged[name] ?? []
        merged[name].push(entry)
      }
    }
  }
  return merged
}

/**
 * @param {object} opts
 * @param {import('./Registry.js').Registry}       opts.registry
 * @param {{ current: (event: string, payload: object) => object }} opts.fireRef
 *   Indirection avoids a circular dependency (Engine creates both State and
 *   Scheduler, then wires them via fireRef after both are constructed).
 * @param {{ current: object | null }}             opts.emitContextRef
 *   Points at the currently executing handler context while Lua code is running.
 *   State.emit() uses it to apply convention-based context inheritance so card
 *   scripts do not have to manually thread cardId/instanceId through every
 *   combat side-effect they emit.
 * @param {Record<string, Record<string, object>>}  opts.allDefs
 *   Live reference; Engine.use() mutates this object as modules are loaded.
 *   State.bind reads from it at call time, so modules registered after engine
 *   creation are visible to subsequent bind calls.
 *
 * @param {{ closed?: boolean }} [opts.lifecycleRef]
 *   Engine-owned lifecycle flag. When closed, State public methods reject new
 *   reads/writes/binds/emits to avoid mutating a disposed runtime.
 *
 * @returns {State}
 */
export function createState({ registry, fireRef, emitContextRef, allDefs, lifecycleRef = null }) {
  // Configurable context-inheritance and required-ctx rules.
  // Populated by engine.use() so that core stays game-agnostic.
  let contextInheritance = {}
  let contextInheritanceMap = {}
  let defaultMatchByKind = {}
  let requiredCtx = {}

  function assertActive(caller) {
    if (lifecycleRef?.closed) {
      throw new Error(`[State.${caller}] engine is closed`)
    }
  }

  function _toPath(parts) {
    if (parts.length === 0) throw new Error('[State] path is required')
    return parts.map((part, idx) => {
      if (part == null) throw new Error(`[State] path segment ${idx} is ${part}`)
      return String(part)
    }).join('.')
  }

  function _normalizeBinding(spec) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new Error('[State.bind] expected a binding spec object: { key, kind, id, ctx }')
    }

    const { key, kind, id, ctx = {}, slot = null } = spec
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('[State.bind] key must be a non-empty string')
    }
    if (typeof kind !== 'string' || kind.length === 0) {
      throw new Error('[State.bind] kind must be a non-empty string')
    }
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('[State.bind] id must be a non-empty string')
    }
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
      throw new Error('[State.bind] ctx must be an object')
    }
    if (slot != null && (!Number.isInteger(slot) || slot < 0)) {
      throw new Error('[State.bind] slot must be a non-negative integer when provided')
    }
    return {
      key,
      kind,
      id,
      slot,
      moduleId: `${kind}/${id}`,
      ctx,
      descriptor: { kind, id, ctx, slot },
    }
  }

  function _inferDefaultMatch(kind, ctx) {
    const rules = defaultMatchByKind[kind]
    if (!rules) return null
    const match = {}
    for (const [payloadKey, ctxKey] of Object.entries(rules)) {
      if (ctx?.[ctxKey] != null) match[payloadKey] = ctxKey
    }
    return Object.keys(match).length > 0 ? match : null
  }

  function _inheritContext(event, payload) {
    const base = (payload && typeof payload === 'object' && !Array.isArray(payload))
      ? { ...payload }
      : {}

    const inheritedKeys = contextInheritance[event]
    if (!inheritedKeys || inheritedKeys.length === 0) return base

    const current = emitContextRef?.current ?? null
    if (!current) return base

    const currentPayload = current?.payload
    const currentCtx = current?.ctx ?? {}

    for (const key of inheritedKeys) {
      if (base[key] != null) continue
      const mapRule = contextInheritanceMap[key]
      if (mapRule?.ctxKey != null) {
        const value = currentCtx?.[mapRule.ctxKey]
        if (value != null) base[key] = value
        continue
      }
      const value = currentPayload?.[key] ?? currentCtx?.[key] ?? null
      if (value != null) base[key] = value
    }

    return base
  }

  // ─── Public API (exposed to JS consumers and injected into Lua as `State`) ──

  function _get(...parts) {
    assertActive('get')
    const path = _toPath(parts)
    const v = registry.get(path)
    if (v == null) return undefined
    return typeof v === 'object' ? luaSafe(v) : v
  }

  function _set(...partsAndValue) {
    assertActive('set')
    if (partsAndValue.length < 2) {
      throw new Error('[State.set] expected path plus value')
    }
    let value = partsAndValue.pop()
    const path = _toPath(partsAndValue)
    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0 &&
      Array.isArray(registry.get(path))
    ) {
      value = []
    }
    registry.set(path, value ?? null)
  }

  function _emit(event, payload) {
    assertActive('emit')
    return fireRef.current(event, _inheritContext(event, payload ?? {}))
  }

  function _keys(...parts) {
    assertActive('keys')
    const path = _toPath(parts)
    const v = registry.get(path)
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return []
    return Object.keys(v)
  }

  function _bind(spec) {
    assertActive('bind')
    const binding = _normalizeBinding(spec)
    const { key, kind, id, moduleId: normalizedModuleId, ctx, slot } = binding
    const def = allDefs[kind]?.[id]
    if (!def) {
      throw new Error(`[State.bind] def not found: "${normalizedModuleId}" — did you call engine.use() before bind?`)
    }

    const requiredKeys = requiredCtx[kind]
    if (requiredKeys) {
      for (const ctxKey of requiredKeys) {
        if (typeof ctx?.[ctxKey] !== 'string' || ctx[ctxKey].length === 0) {
          throw new Error(`[State.bind] "${kind}" requires ctx.${ctxKey} to be a non-empty string`)
        }
      }
    }

    const defaultMatch = _inferDefaultMatch(kind, ctx)
    const bindSnapshot = registry.snapshot()
    try {
      registry.unregister(key)
      registry.register(def, { registeredBy: key, ctx, slot, defaultMatch })
      registry.setBinding(key, binding.descriptor)
    } catch (error) {
      registry.restore(bindSnapshot)
      throw error
    }
  }

  function _unbind(key) {
    assertActive('unbind')
    registry.unregister(key)
    registry.setBinding(key, null)
  }

  /**
   * Public API exposed to JS consumers.
   * JS side gets the full surface (including bind/unbind).
   */
  const state = { get: _get, set: _set, emit: _emit, keys: _keys, bind: _bind, unbind: _unbind }

  /**
   * Lua-facing subset — no bind/unbind.
   * Engine.js will additionally attach RNG utilities (hashString/random/shuffle)
   * so that existing Lua scripts can keep calling State.random() etc.
   */
  const luaApi = { get: _get, set: _set, emit: _emit, keys: _keys }

  // ─── Internal API (used by Engine.js, never exposed to consumers) ───────────

  const internals = {
    getConfig() {
      return {
        contextInheritance: deepClone(contextInheritance),
        contextInheritanceMap: deepClone(contextInheritanceMap),
        defaultMatchByKind: deepClone(defaultMatchByKind),
        requiredCtx: deepClone(requiredCtx),
      }
    },

    setConfig(cfg) {
      contextInheritance = cfg?.contextInheritance ? deepClone(cfg.contextInheritance) : {}
      contextInheritanceMap = cfg?.contextInheritanceMap ? deepClone(cfg.contextInheritanceMap) : {}
      defaultMatchByKind = cfg?.defaultMatchByKind ? deepClone(cfg.defaultMatchByKind) : {}
      requiredCtx = cfg?.requiredCtx ? deepClone(cfg.requiredCtx) : {}
    },

    mergeModule(module) {
      if (module.contextInheritance) {
        contextInheritance = mergeStringListMap(contextInheritance, module.contextInheritance)
      }
      if (module.contextInheritanceMap) {
        for (const [k, v] of Object.entries(module.contextInheritanceMap)) {
          if (v != null && typeof v === 'object' && typeof v.ctxKey === 'string') {
            contextInheritanceMap[k] = { ctxKey: v.ctxKey }
          }
        }
      }
      if (module.defaultMatchByKind) {
        for (const [kind, rules] of Object.entries(module.defaultMatchByKind)) {
          defaultMatchByKind[kind] = { ...(defaultMatchByKind[kind] ?? {}), ...(typeof rules === 'object' && !Array.isArray(rules) ? rules : {}) }
        }
      }
      if (module.requiredCtx) {
        requiredCtx = mergeStringListMap(requiredCtx, module.requiredCtx)
      }
    },
  }

  return { state, luaApi, internals }
}

/**
 * @typedef {ReturnType<typeof createState>['state']} State
 */
