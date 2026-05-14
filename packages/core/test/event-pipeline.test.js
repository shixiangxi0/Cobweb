import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/Engine.js'

describe('evt-core event pipeline', () => {
  async function engineWithRules(rules) {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      rules,
    })
    engine.load({})
    return engine
  }

  it('executes handlers in descending order', async () => {
    const engine = await engineWithRules([
      {
        id: 'rule:third',
        hooks: { 'event:test:event': { order: 100, script: 'State.set("seq", (State.get("seq") or "") .. "C")' } },
      },
      {
        id: 'rule:first',
        hooks: { 'event:test:event': { order: 300, script: 'State.set("seq", (State.get("seq") or "") .. "A")' } },
      },
      {
        id: 'rule:second',
        hooks: { 'event:test:event': { order: 200, script: 'State.set("seq", (State.get("seq") or "") .. "B")' } },
      },
    ])
    engine.state.emit('test:event', {})
    expect(engine.getState().seq).toBe('ABC')
    engine.close()
  })

  it('stops executing when payload.cancelled is set', async () => {
    const engine = await engineWithRules([
      {
        id: 'rule:cancel',
        hooks: { 'event:test:event': { order: 200, script: 'Event.cancelled = true' } },
      },
      {
        id: 'rule:after',
        hooks: { 'event:test:event': { order: 100, script: 'State.set("ran", true)' } },
      },
    ])
    engine.state.emit('test:event', {})
    expect(engine.getState().ran).toBeUndefined()
    engine.close()
  })

  it('filters bound handlers by match criteria', async () => {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      defs: {
        card: {
          strike: {
            id: 'strike',
            hooks: {
              'event:test:event': {
                order: 100,
                match: { kind: 'cardId' },
                script: 'State.set("matched", true)',
              },
            },
          },
        },
      },
    })
    engine.load({})

    // bind without cardId in ctx → registration succeeds, but match never satisfies at runtime
    engine.state.bind({ key: 'card:x', kind: 'card', id: 'strike', ctx: {} })

    // emit without matching payload kind → handler skipped (ctx has no cardId to match against)
    engine.state.emit('test:event', { kind: 'strike' })
    expect(engine.getState().matched).toBeUndefined()

    engine.state.unbind('card:x')

    // bind with cardId → handler registered and match works at runtime
    engine.state.bind({ key: 'card:ok', kind: 'card', id: 'strike', ctx: { cardId: 'strike' } })

    // emit with matching kind → handler executes
    engine.state.emit('test:event', { kind: 'strike' })
    expect(engine.getState().matched).toBe(true)
    engine.close()
  })

  it('throws for undeclared events', async () => {
    const engine = await createEngine()
    engine.load({})
    expect(() => engine.state.emit('undeclared:event', {}))
      .toThrow(/No pipeline for event/)
    engine.close()
  })
})
