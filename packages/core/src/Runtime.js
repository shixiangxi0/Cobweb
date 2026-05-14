/**
 * Runtime.js — Lua VM encapsulation.
 *
 * Wraps wasmoon (https://github.com/nicholasgasior/wasmoon) with a minimal API.
 * The rest of the engine depends only on this interface, not on wasmoon directly,
 * so the VM can be swapped out (e.g. for a pure-JS interpreter) without touching
 * any other file.
 *
 * Key design notes
 * ────────────────
 * injectObjects: false
 *   wasmoon copies JS objects into Lua tables rather than wrapping them in a proxy.
 *   This means handler A can modify Event.amount and handler B will read the modified
 *   value — because both handlers run against the same Lua global `Event` table
 *   within a single pipeline invocation. The `payload` object passed to runScript()
 *   may therefore be mutated. Scheduler clones caller payloads at the event boundary
 *   so external callers do not observe those in-flight mutations.
 *
 * Nested event handling
 *   When a Lua handler calls State.emit(), fire() recurses and eventually calls
 *   runScript() again (isNested = true). We save and restore the outer `Event`
 *   and `Ctx` globals so the outer handler can continue reading its own payload
 *   and binding context after the inner emit returns.
 *
 * Sandbox
 *   io, os, require, load, dofile, loadfile are set to nil after VM creation.
 *   Scripts get only the standard safe math/string/table/coroutine libraries and
 *   whatever objects the engine injects (currently just `State`, `Event`, and `Ctx`).
 */
import wasmoon from 'wasmoon'
const LuaFactory = wasmoon.LuaFactory ?? wasmoon.default?.LuaFactory

export class Runtime {
  constructor() {
    this._lua = null
  }

  /**
   * Initialise the Lua VM. Must be awaited before any other method is called.
   * @returns {Promise<Runtime>}
   */
  async init() {
    const factory = new LuaFactory()
    this._lua = await factory.createEngine({
      openStandardLibs: true,
      injectObjects:    false,
    })
    // Remove globals that could break the sandbox or cause I/O side-effects
    this._lua.doStringSync('io=nil; os=nil; require=nil; load=nil; dofile=nil; loadfile=nil; debug=nil; package=nil')
    return this
  }

  /**
   * Execute a Lua script, injecting `payload` as the global `Event` and
   * `ctx` as the global `Ctx`.
   *
   * The script is wrapped in an immediately-invoked function so that `return`
   * statements inside handler scripts are valid Lua syntax.
   *
   * @param {string}  script
   * @param {object}  payload   Becomes the Lua global `Event`. May be mutated
   *                            by the script (e.g. Event.amount = Event.amount - 3).
   * @param {object}  ctx       Binding context for the current handler.
   *                            Exposed as the Lua global `Ctx`.
   * @param {boolean} isNested  Pass true when called from inside another handler
   *                            (depth > 1) so the outer Event is restored afterwards.
   */
  runScript(script, payload, ctx = {}, isNested = false) {
    if (!script) return

    let savedEvent
    let savedCtx
    if (isNested) {
      savedEvent = this._lua.global.get('Event')
      savedCtx = this._lua.global.get('Ctx')
    }

    this._lua.global.set('Event', payload ?? {})
    this._lua.global.set('Ctx', ctx ?? {})
    try {
      this._lua.doStringSync(`(function()\n${script}\nend)()`)
    } catch (e) {
      // Rethrow with a prefix that survives stack unwinding through wasmoon
      throw new Error(`[Runtime] ${e?.message ?? String(e)}`, { cause: e })
    } finally {
      if (isNested) {
        this._lua.global.set('Event', savedEvent ?? {})
        this._lua.global.set('Ctx', savedCtx ?? {})
      }
    }
  }

  /**
   * Inject a JS value as a named Lua global.
   * @param {string} name
   * @param {any}    value
   */
  set(name, value) { this._lua.global.set(name, value) }

  /**
   * Read a Lua global back into JS.
   * @param {string} name
   * @returns {any}
   */
  get(name) { return this._lua.global.get(name) }

  /**
   * Release VM resources. Call when the engine is no longer needed.
   */
  close() { this._lua?.global.close() }
}
