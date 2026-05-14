import { describe, expect, it } from 'vitest'

import { createEngine } from '../src/Engine.js'

describe('@netweave/core public entry', () => {
  it('merges module context conventions across multiple use() calls', async () => {
    const engine = await createEngine()

    try {
      engine.use({
        events: {
          'game:tick': { action: 'GAME_TICK' },
          'effect:emit': { action: 'EFFECT_EMIT' },
        },
        requiredCtx: {
          card: ['iid'],
        },
        contextInheritance: {
          'effect:emit': ['cardId'],
        },
        rules: [
          {
            id: 'rule:effect:observe',
            hooks: {
              'event:effect:emit': `
                State.set('observed', 'cardId', Event.cardId)
                State.set('observed', 'instanceId', Event.instanceId)
              `,
            },
          },
        ],
        defs: {
          card: {
            pulse: {
              id: 'pulse',
              hooks: {
                'event:game:tick': `
                  State.emit('effect:emit', {})
                `,
              },
            },
          },
        },
      })

      engine.use({
        requiredCtx: {
          enemy: ['self'],
        },
        contextInheritance: {
          'effect:emit': ['instanceId'],
        },
        defs: {
          enemy: {
            slug: {
              id: 'slug',
              hooks: {
                'event:game:tick': 'return',
              },
            },
          },
        },
      })

      expect(() => engine.state.bind({ key: 'card:missing', kind: 'card', id: 'pulse', ctx: {} }))
        .toThrow(/ctx\.iid/)
      expect(() => engine.state.bind({ key: 'enemy:missing', kind: 'enemy', id: 'slug', ctx: {} }))
        .toThrow(/ctx\.self/)

      engine.load({})
      engine.state.bind({ key: 'card:ok', kind: 'card', id: 'pulse', ctx: { iid: 'c1', cardId: 'pulse' } })
      engine.state.emit('game:tick', { instanceId: 'c1' })

      expect(engine.getState().observed).toEqual({
        cardId: 'pulse',
        instanceId: 'c1',
      })
    } finally {
      engine.close()
    }
  })

  it('exposes an idempotent close lifecycle API', async () => {
    const engine = await createEngine()

    engine.close()
    expect(() => engine.close()).not.toThrow()
    expect(() => engine.getState()).toThrow(/engine is closed/)
    expect(() => engine.state.get('anything')).toThrow(/engine is closed/)
  })
})
