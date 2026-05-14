/**
 * bindings/lifecycle.js — STS 特有的绑定生命周期钩子
 *
 * 这些钩子从 evt-core 的通用引擎层迁移而来，属于游戏层而非引擎层。
 * 通过 createEngine({ preFire, afterFire }) 注入，使引擎保持游戏无关。
 *
 * 钩子只使用 engine.state 的公开 API（get/set/bind/unbind/keys），
 * 不直接接触引擎内部对象。
 */

function hasBinding(state, key) {
  return state.get('_bindings', key) != null
}

export function createStsLifecycleHooks() {
  return {
    preFire(event, payload, { state }) {
      // Auto-bind enemies before battle:start handlers run so that nested
      // enemy:update events see the bindings.
      if (event === 'battle:start') {
        for (let slot = 1; slot <= 10; slot++) {
          const eid = state.get('battle', 'enemies', String(slot))
          if (eid) {
            const typeId = state.get('battle', 'entities', eid, 'typeId')
            if (typeId && !hasBinding(state, eid)) {
              state.bind({ key: eid, kind: 'enemy', id: typeId, ctx: { self: eid } })
            }
          }
        }
      }
      // Auto-bind cards before card:move handlers run so that semantic events
      // (card:drawn, card:discarded, card:exhausted) route correctly.
      if (event === 'card:move') {
        const iid = payload.instanceId
        const cardId = payload.cardId
        if (iid && cardId && !hasBinding(state, iid)) {
          state.bind({ key: iid, kind: 'card', id: cardId, ctx: { iid, cardId, action: cardId } })
        }
      }
    },

    afterFire(event, payload, { state }) {
      // Auto-bind status on first apply (stacks went from 0/null to positive)
      if (event === 'status:apply') {
        const target = payload.target
        const typeId = payload.typeId
        if (target && typeId) {
          const stacks = state.get('battle', 'entities', target, 'statuses', typeId, 'stacks')
          if (stacks > 0) {
            const key = `${target}:${typeId}`
            if (!hasBinding(state, key)) {
              state.bind({ key, kind: 'status', id: typeId, ctx: { self: target } })
            }
          }
        }
      }
      // Auto-unbind status on remove
      if (event === 'status:remove') {
        const target = payload.target
        const typeId = payload.typeId
        if (target && typeId) {
          const key = `${target}:${typeId}`
          if (hasBinding(state, key)) {
            state.unbind(key)
          }
        }
      }
      // Auto-unbind enemy on death
      if (event === 'entity:die') {
        const target = payload.target
        if (target && target !== 'player') {
          if (hasBinding(state, target)) {
            state.unbind(target)
          }
        }
      }
      // Auto-unbind all enemies when battle ends (victory or defeat flow)
      if (event === 'flow:victory' || event === 'flow:defeat') {
        for (const key of state.keys('_bindings')) {
          const desc = state.get('_bindings', key)
          if (desc?.kind === 'enemy') {
            state.unbind(key)
          }
        }
      }
      // Auto-bind relic on acquisition (cross-run permanent object)
      if (event === 'relic:acquire') {
        const relicId = payload.relicId
        if (!relicId) return
        const owned = state.get('run', 'relics') || []
        if (owned.includes(relicId)) return
        state.set('run', 'relics', [...owned, relicId])
        const key = `relic_${relicId}`
        if (!hasBinding(state, key)) {
          state.bind({ key, kind: 'relic', id: relicId })
        }
      }
    },
  }
}
