import { describe, expect, it } from 'vitest'
import { createEngine } from '../src/Engine.js'

describe('evt-core transaction', () => {
  async function engineWithBundleHook() {
    const bundles = []
    const engine = await createEngine({
      onBundle: (bundle) => bundles.push(bundle),
    })
    engine.use({
      events: {
        'test:root': { action: 'TEST_ROOT' },
        'test:nested': { action: 'TEST_NESTED' },
      },
      rules: [
        {
          id: 'root:handler',
          hooks: {
            'event:test:root': `
              State.set('a', 1)
              State.emit('test:nested', {})
            `,
          },
        },
        {
          id: 'nested:handler',
          hooks: {
            'event:test:nested': 'State.set("b", 2)',
          },
        },
      ],
    })
    engine.load({})
    return { engine, bundles }
  }

  it('emits a bundle after root event commits', async () => {
    const { engine, bundles } = await engineWithBundleHook()
    engine.state.emit('test:root', {})
    expect(bundles.length).toBe(1)
    expect(bundles[0].rootEvent).toBe('test:root')
    expect(engine.getState().a).toBe(1)
    expect(engine.getState().b).toBe(2)
    engine.close()
  })

  it('rolls back state when a handler throws', async () => {
    const { engine, bundles } = await engineWithBundleHook()
    engine.use({
      rules: [
        {
          id: 'rule:throw',
          hooks: {
            'event:test:root': {
              order: 50,
              script: 'State.set("c", 3); error("boom")',
            },
          },
        },
      ],
    })
    expect(() => engine.state.emit('test:root', {})).toThrow(/boom/)
    expect(engine.getState().a).toBeUndefined()
    expect(engine.getState().b).toBeUndefined()
    expect(engine.getState().c).toBeUndefined()
    expect(bundles.length).toBe(0)
    engine.close()
  })

  it('bundle contains patches and timeline', async () => {
    const { engine, bundles } = await engineWithBundleHook()
    engine.state.emit('test:root', {})
    const bundle = bundles[0]
    expect(Array.isArray(bundle.patches)).toBe(true)
    expect(Array.isArray(bundle.timeline)).toBe(true)
    expect(bundle.timeline.some((e) => e.event === 'test:root')).toBe(true)
    expect(bundle.timeline.some((e) => e.event === 'test:nested')).toBe(true)
    engine.close()
  })
})
