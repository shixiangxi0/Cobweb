import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/Engine.js'

describe('evt-core engine API', () => {
  it('creates an engine with default options', async () => {
    const engine = await createEngine()
    expect(typeof engine.use).toBe('function')
    expect(typeof engine.load).toBe('function')
    expect(typeof engine.getState).toBe('function')
    expect(typeof engine.state.get).toBe('function')
    expect(typeof engine.close).toBe('function')
    engine.close()
  })

  it('registers events, rules, defs, inject and pools via use()', async () => {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      rules: [
        {
          id: 'test:rule',
          hooks: { 'event:test:event': 'State.set("x", 1)' },
        },
      ],
      defs: { card: { strike: { id: 'strike', hooks: {} } } },
      inject: { Foo: { bar: 42 }, Pools: { cards: ['a', 'b'] } },
    })
    engine.load({})
    engine.state.emit('test:event', {})
    expect(engine.getState().x).toBe(1)
    engine.close()
  })

  it('load() restores state and replays bindings', async () => {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      defs: { card: { strike: { id: 'strike', hooks: { 'event:test:event': 'State.set("bound", true)' } } } },
    })
    engine.load({ _bindings: { 'card:strike': { kind: 'card', id: 'strike', ctx: {} } } })
    engine.state.emit('test:event', {})
    expect(engine.getState().bound).toBe(true)
    engine.close()
  })

  it('getState() returns a deep clone snapshot', async () => {
    const engine = await createEngine()
    engine.load({ a: { b: 1 } })
    const s1 = engine.getState()
    const s2 = engine.getState()
    expect(s1).toEqual(s2)
    s1.a.b = 99
    expect(engine.getState().a.b).toBe(1)
    engine.close()
  })

  it('close() is idempotent and rejects further operations', async () => {
    const engine = await createEngine()
    engine.close()
    expect(() => engine.close()).not.toThrow()
    expect(() => engine.getState()).toThrow(/closed/)
    expect(() => engine.state.get('x')).toThrow(/closed/)
  })
})
