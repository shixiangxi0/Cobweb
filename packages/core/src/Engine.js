
/**
 * Engine.js — assembly and public API.
 *
 * createEngine() wires together Registry, Runtime, State, and Scheduler.
 * It exposes the following public API to the outside world:
 *
 *   use(module)   register a game module (events / rules / defs)
 *   load(store)   restore a saved state and replay dynamic bindings
 *   getState()    snapshot of the current state tree (safe to serialise)
 *   state         the live State object (JS & Lua share the same reference)
 *   close()       release the underlying runtime
 *
 * Notable: startBattle, playCard, endTurn — none of these exist here.
 * Game-specific orchestration lives in the game layer, not the engine.
 */
import { Registry }        from './Registry.js'
import { Runtime }         from './Runtime.js'
import { createState }     from './State.js'
import { createScheduler } from './Scheduler.js'
import { hashString, random, shuffle } from './rng.js'

/**
 * Create and initialise an Engine instance.
 *
 * @param {object}   [opts={}]
 * @param {(bundle: Bundle) => void} [opts.onBundle]
 *   Called synchronously after every root-level event completes.
 * @param {EnrichFn} [opts.enrich]
 *   Optional payload transformer invoked after each event pipeline.
 * @returns {Promise<Engine>}
 */
export async function createEngine({ onBundle = () => {}, enrich, preFire, afterFire } = {}) {
  const registry = new Registry()
  const runtime  = new Runtime()
  await runtime.init()

  const fireRef = { current: null }
  const emitContextRef = { current: null }
  const lifecycleRef = { closed: false }

  const allDefs = {}
  const staticRuleIds = new Set()

  const { state, luaApi, internals } = createState({ registry, fireRef, allDefs, emitContextRef, lifecycleRef })

  // Attach RNG utilities to the Lua-facing State object so existing scripts
  // can keep calling State.random() / State.shuffle() / State.hashString().
  // We also inject a standalone Rng global for new code.
  const luaState = { ...luaApi, hashString, random, shuffle }

  const fire = createScheduler({
    emitContextRef,
    registry,
    runtime,
    enrich,
    onBundle,
    preFire: preFire
      ? (event, payload) => preFire(event, payload, { state })
      : undefined,
    afterFire: afterFire
      ? (event, payload) => afterFire(event, payload, { state })
      : undefined,
  })

  fireRef.current = fire
  runtime.set('State', luaState)
  runtime.set('Rng', { hashString, random, shuffle })

  // ─── Private ──────────────────────────────────────────────────────────────

  function _clearDynamic() {
    for (const key of Object.keys(registry.getBindings())) {
      registry.unregister(key)
    }
  }

  function _buildDefCatalog(defs) {
    const catalog = {}
    for (const [kind, entries] of Object.entries(defs)) {
      catalog[kind] = {}
      for (const [id, def] of Object.entries(entries)) {
        const { hooks: _h, display: _d, ...base } = def
        catalog[kind][id] = base
      }
    }
    return catalog
  }

  function _syncDefsGlobal() {
    if (Object.keys(allDefs).length > 0) {
      runtime.set('Defs', _buildDefCatalog(allDefs))
    } else {
      runtime.set('Defs', undefined)
    }
  }

  function _assertOpen(caller) {
    if (lifecycleRef.closed) {
      throw new Error(`[Engine.${caller}] engine is closed`)
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  function use(module = {}) {
    _assertOpen('use')

    for (const [event, conf] of Object.entries(module.events ?? {})) {
      registry.definePipeline(event, conf)
    }

    for (const rule of module.rules ?? []) {
      if (staticRuleIds.has(rule.id)) {
        throw new Error(`[Engine.use] duplicate rule id "${rule.id}"`)
      }
      staticRuleIds.add(rule.id)
      registry.register(rule, { registeredBy: rule.id })
    }

    if (module.defs) {
      for (const [kind, entries] of Object.entries(module.defs)) {
        allDefs[kind] ??= {}
        for (const [id, def] of Object.entries(entries)) {
          if (allDefs[kind][id]) {
            throw new Error(`[Engine.use] duplicate def "${kind}/${id}"`)
          }
          allDefs[kind][id] = def
        }
      }
      _syncDefsGlobal()
    }

    internals.mergeModule(module)

    if (module.inject) {
      for (const [name, value] of Object.entries(module.inject)) {
        runtime.set(name, value)
      }
    }
  }

  function load(store = {}) {
    _assertOpen('load')
    const nextStore = store ?? {}
    const snapshot = registry.snapshot()

    try {
      _clearDynamic()
      registry.resetState(nextStore)
      for (const [key, desc] of Object.entries(nextStore._bindings ?? {})) {
        if (!desc?.kind || !desc?.id) {
          throw new Error(`[Engine.load] invalid binding descriptor for "${key}" — expected { kind, id, ctx }`)
        }
        state.bind({ key, kind: desc.kind, id: desc.id, ctx: desc.ctx ?? {}, slot: desc.slot ?? null })
      }
      registry.flushPatches()
    } catch (error) {
      registry.restore(snapshot)
      throw error
    }
  }

  function getState() {
    _assertOpen('getState')
    return registry.getState()
  }

  function close() {
    if (lifecycleRef.closed) return
    lifecycleRef.closed = true
    emitContextRef.current = null
    fireRef.current = () => {
      throw new Error('[Engine.state.emit] engine is closed')
    }
    runtime.close()
  }

  return { use, load, getState, state, close }
}

// ─── Type documentation ───────────────────────────────────────────────────────

/**
 * @typedef {object} Module
 * @property {Record<string, { action?: string }>} [events]
 * @property {ModuleDef[]} [rules]
 * @property {Record<string, Record<string, ModuleDef>>} [defs]
 * @property {Record<string, string[]>} [contextInheritance]
 * @property {Record<string, { ctxKey: string }>} [contextInheritanceMap]
 * @property {Record<string, Record<string, string>>} [defaultMatchByKind]
 * @property {Record<string, string[]>} [requiredCtx]
 *
 * @typedef {{ id: string, hooks: Record<string, string | { script: string, order?: number, match?: Record<string, string> }> }} ModuleDef
 *
 * @typedef {object} Bundle
 * @property {string} rootEvent
 * @property {import('./Registry.js').Patch[]} patches
 * @property {TimelineEntry[]} timeline
 *
 * @typedef {object} TimelineEntry
 * @property {string} action
 * @property {string} event
 * @property {number} seq
 * @property {object} payload
 *
 * @typedef {(name: string, payload: object, getState: () => object) => object} EnrichFn
 *
 * @typedef {object} Engine
 * @property {(module: Module) => void}    use
 * @property {(store: object) => void}     load
 * @property {() => object}                getState
 * @property {import('./State.js').State['state']}  state
 * @property {() => void}                  close
 */
