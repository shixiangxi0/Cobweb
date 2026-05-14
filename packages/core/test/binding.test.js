import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/Engine.js'

describe('evt-core binding system', () => {
  async function setup() {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      defs: {
        effect: {
          strike: {
            id: 'strike',
            hooks: {
              'event:test:event': 'State.set("fromBinding", Ctx.self)',
            },
          },
        },
      },
      requiredCtx: { effect: ['self'] },
    })
    engine.load({})
    return engine
  }

  it('bind registers a def hooks under a key', async () => {
    const engine = await setup()
    engine.state.bind({ key: 'eff:s1', kind: 'effect', id: 'strike', ctx: { self: 's1' } })
    engine.state.emit('test:event', {})
    expect(engine.getState().fromBinding).toBe('s1')
    engine.close()
  })

  it('unbind removes the registered hooks', async () => {
    const engine = await setup()
    engine.state.bind({ key: 'eff:s1', kind: 'effect', id: 'strike', ctx: { self: 's1' } })
    engine.state.unbind('eff:s1')
    engine.state.emit('test:event', {})
    expect(engine.getState().fromBinding).toBeUndefined()
    engine.close()
  })

  it('bind is idempotent — same key re-registers', async () => {
    const engine = await setup()
    engine.state.bind({ key: 'eff:s1', kind: 'effect', id: 'strike', ctx: { self: 'first' } })
    engine.state.bind({ key: 'eff:s1', kind: 'effect', id: 'strike', ctx: { self: 'second' } })
    engine.state.emit('test:event', {})
    expect(engine.getState().fromBinding).toBe('second')
    engine.close()
  })

  it('load replays bindings from _bindings snapshot', async () => {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      defs: {
        effect: {
          strike: {
            id: 'strike',
            hooks: { 'event:test:event': 'State.set("replayed", true)' },
          },
        },
      },
    })
    engine.load({
      _bindings: {
        'eff:strike_1': { kind: 'effect', id: 'strike', ctx: { self: 'strike_1' } },
      },
    })
    engine.state.emit('test:event', {})
    expect(engine.getState().replayed).toBe(true)
    engine.close()
  })

  it('validates required context fields on bind', async () => {
    const engine = await setup()
    expect(() => engine.state.bind({ key: 'eff:x', kind: 'effect', id: 'strike', ctx: {} }))
      .toThrow(/ctx\.self/)
    engine.close()
  })
})
