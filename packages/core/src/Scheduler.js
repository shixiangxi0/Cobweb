/**
 * Scheduler.js — the event execution loop.
 *
 * createScheduler() returns the public `fire(event, payload)` function.
 * Nested emits share the same depth counter, sequence counter, timeline buffer,
 * and root bundle emission. Each root fire() is transactional: if any handler
 * throws, state/timeline/pipeline mutations from that root invocation are rolled
 * back and no bundle is emitted.
 */
import { deepClone } from './util.js'

/**
 * @param {object} opts
 * @param {import('./Registry.js').Registry} opts.registry
 * @param {import('./Runtime.js').Runtime}   opts.runtime
 * @param {{ current: object | null }}       opts.emitContextRef
 * @param {(bundle: object) => void}         opts.onBundle
 * @param {((name: string, payload: object, getState: () => object) => object) | undefined}
 *   opts.enrich   Optional payload transformer called after all handlers run.
 *
 * @returns {(event: string, payload?: object) => object}
 */
export function createScheduler({ registry, runtime, emitContextRef, onBundle, enrich, preFire, afterFire }) {
  let depth      = 0
  let timeline   = []
  let seqCounter = 0
  const executing = new Set()
  const eventStack = []
  const handlerStack = []

  function sanitizePayload(value, seen = new WeakMap()) {
    if (value === null || value === undefined) return undefined
    if (typeof value !== 'object') return value
    if (seen.has(value)) return seen.get(value)

    if (Array.isArray(value)) {
      const clean = []
      seen.set(value, clean)
      for (let index = 0; index < value.length; index++) {
        const next = sanitizePayload(value[index], seen)
        if (next !== undefined) clean.push(next)
      }
      return clean
    }

    const clean = {}
    seen.set(value, clean)
    for (const [key, nextValue] of Object.entries(value)) {
      const next = sanitizePayload(nextValue, seen)
      if (next !== undefined) clean[key] = next
    }
    return clean
  }

  function enrichPayload(name, payload) {
    const enriched = enrich ? enrich(name, payload, () => registry.peekState()) : payload
    if (enriched === null || enriched === undefined) return {}
    if (typeof enriched !== 'object') return enriched
    return deepClone(enriched)
  }

  function withInvocation(rootEvent, execute) {
    const isRoot = (depth === 0)
    const rootSnapshot = isRoot ? registry.snapshot() : null
    if (isRoot) {
      timeline = []
      seqCounter = 0
    }

    depth++
    const mySeq = seqCounter++
    let failed = false

    try {
      return execute(mySeq)
    } catch (error) {
      failed = true
      if (isRoot) {
        registry.restore(rootSnapshot)
        timeline = []
        seqCounter = 0
      }
      throw error
    } finally {
      depth--

      if (isRoot && !failed) {
        const bundle = {
          rootEvent,
          patches:  registry.flushPatches(),
          timeline: timeline.slice(),
        }
        timeline = []
        try {
          onBundle(bundle)
        } catch (error) {
          console.error(`[Scheduler] onBundle failed after commit for root event "${bundle.rootEvent}"`, error)
          throw error
        }
      }
    }
  }

  function matchesFilter(handler, payload) {
    if (!handler.match) return true
    for (const [payloadKey, ctxKey] of Object.entries(handler.match)) {
      const payloadValue = payload[payloadKey]
      if (payloadValue === undefined) continue
      if (payloadValue !== handler.ctx[ctxKey]) return false
    }
    return true
  }

  function runGuarded(event, handler, payload) {
    const guard = `${handler.registeredBy}:${event}`
    if (executing.has(guard)) return
    executing.add(guard)
    const previousEmitContext = emitContextRef?.current ?? null
    handlerStack.push({
      event,
      registeredBy: handler.registeredBy ?? null,
      moduleId: handler.moduleId ?? null,
    })
    if (emitContextRef) {
      emitContextRef.current = {
        event,
        payload,
        ctx: handler.ctx ?? {},
        registeredBy: handler.registeredBy ?? null,
        moduleId: handler.moduleId ?? null,
      }
    }
    try {
      runtime.runScript(handler.script, payload, handler.ctx ?? {}, depth > 1)
    } finally {
      if (emitContextRef) emitContextRef.current = previousEmitContext
      handlerStack.pop()
      executing.delete(guard)
    }
  }

  function fire(event, payload = {}) {
    payload = sanitizePayload(payload ?? {}) ?? {}

    const pipeline = registry.getPipeline(event)
    if (!pipeline) {
      throw new Error(`[Scheduler] No pipeline for event "${event}" — declare it in module.events first`)
    }

    return withInvocation(event, (mySeq) => {
      const parentFrame = eventStack[eventStack.length - 1] ?? null
      const handlerFrame = handlerStack[handlerStack.length - 1] ?? null
      const eventFrame = {
        seq: mySeq,
        rootSeq: parentFrame?.rootSeq ?? mySeq,
        parentSeq: parentFrame?.seq ?? null,
        depth: parentFrame ? parentFrame.depth + 1 : 0,
        causeBy: handlerFrame?.registeredBy ?? null,
      }

      eventStack.push(eventFrame)

      try {
        if (preFire) {
          preFire(event, payload)
        }

        const snapshot = pipeline.handlers.slice()
        const liveSet = new Set(pipeline.handlers)

        for (const h of snapshot) {
          if (payload.cancelled) break
          if (!liveSet.has(h)) continue
          if (!matchesFilter(h, payload)) continue

          runGuarded(event, h, payload)
        }

        if (!payload.cancelled && afterFire) {
          afterFire(event, payload)
        }

        if (pipeline.action && !payload.cancelled) {
          timeline.push({
            kind: 'event',
            action: pipeline.action,
            event,
            rootSeq: eventFrame.rootSeq,
            parentSeq: eventFrame.parentSeq,
            depth: eventFrame.depth,
            causeBy: eventFrame.causeBy,
            seq: mySeq,
            payload: enrichPayload(event, payload),
          })
        }

        return payload
      } finally {
        eventStack.pop()
      }
    })
  }

  return fire
}
