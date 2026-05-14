import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/Engine.js'

describe('evt-core state tree', () => {
  async function setup() {
    const engine = await createEngine()
    engine.use({ events: { 'noop': { action: 'NOOP' } } })
    engine.load({})
    return engine
  }

  it('get reads nested paths', async () => {
    const engine = await setup()
    engine.state.set('a', 'b', 'c', 42)
    expect(engine.state.get('a', 'b', 'c')).toBe(42)
    expect(engine.state.get('a', 'b')).toEqual({ c: 42 })
    expect(engine.state.get('missing')).toBeUndefined()
    expect(engine.state.get('a', 'missing', 'x')).toBeUndefined()
    engine.close()
  })

  it('set writes nested paths', async () => {
    const engine = await setup()
    engine.state.set('run', 'gold', 100)
    engine.state.set('run', 'player', 'hp', 75)
    expect(engine.getState().run).toEqual({ gold: 100, player: { hp: 75 } })
    engine.close()
  })

  it('set with null deletes the key', async () => {
    const engine = await setup()
    engine.state.set('temp', { a: 1, b: 2 })
    engine.state.set('temp', 'a', null)
    expect(engine.state.get('temp')).toEqual({ b: 2 })
    engine.close()
  })

  it('set replaces entire subtrees', async () => {
    const engine = await setup()
    engine.state.set('battle', { enemies: { '1': 'e1' }, turn: 1 })
    engine.state.set('battle', { enemies: { '2': 'e2' } })
    expect(engine.getState().battle).toEqual({ enemies: { '2': 'e2' } })
    engine.close()
  })

  it('arrays are preserved as arrays', async () => {
    const engine = await setup()
    engine.state.set('deck', ['a', 'b', 'c'])
    engine.state.set('deck', ['x', 'y'])
    expect(Array.isArray(engine.getState().deck)).toBe(true)
    expect(engine.getState().deck).toEqual(['x', 'y'])
    engine.close()
  })
})
