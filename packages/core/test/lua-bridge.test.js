import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/Engine.js'

describe('evt-core Lua bridge', () => {
  async function setup() {
    const engine = await createEngine()
    engine.use({
      events: { 'test:event': { action: 'TEST_EVENT' } },
      inject: {
        Pools: {
          cards: [{ id: 'strike', rarity: 'common' }],
          relics: [{ id: 'ring', shopPrice: 150 }],
        },
      },
    })
    engine.load({})
    return engine
  }

  it('State.random and State.shuffle are available in Lua', async () => {
    const engine = await setup()
    engine.load({ meta: { _rngSeed: 12345 } })
    engine.use({
      rules: [
        {
          id: 'rule:inject',
          hooks: {
            'event:test:event': `
              State.set('rngResult', State.random(12345, 1, 10, 20)[1])
              State.set('shuffled', State.shuffle(12345, {'a', 'b', 'c'}))
            `,
          },
        },
      ],
    })
    engine.state.emit('test:event', {})
    const s = engine.getState()
    expect(s.rngResult).toBeGreaterThanOrEqual(10)
    expect(s.rngResult).toBeLessThanOrEqual(20)
    expect(s.shuffled).toHaveLength(3)
    expect(s.shuffled.sort()).toEqual(['a', 'b', 'c'])
    engine.close()
  })

  it('pools are available as Lua global Pools', async () => {
    const engine = await setup()
    engine.use({
      rules: [
        {
          id: 'rule:pools',
          hooks: {
            'event:test:event': `
              local cards = Pools.cards or {}
              local relics = Pools.relics or {}
              State.set('poolCards', #cards)
              State.set('poolRelics', #relics)
            `,
          },
        },
      ],
    })
    engine.state.emit('test:event', {})
    expect(engine.getState().poolCards).toBe(1)
    expect(engine.getState().poolRelics).toBe(1)
    engine.close()
  })

  it('State API is available in Lua', async () => {
    const engine = await setup()
    engine.use({
      rules: [
        {
          id: 'rule:state',
          hooks: {
            'event:test:event': `
              State.set('x', 1)
              local v = State.get('x')
              State.set('y', v + 1)
              State.emit('test:event', { nested = true })
            `,
          },
        },
      ],
    })
    engine.state.emit('test:event', {})
    expect(engine.getState().x).toBe(1)
    engine.close()
  })
})
