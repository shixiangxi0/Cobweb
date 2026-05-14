/**
 * content/enemies/hook_driven.js — 事件驱动敌人
 */

import { BATTLE_ENTITIES_PATH } from '../../bindings/config.js'

// ── 时间窃贼 ─────────────────────────────────────────────────────────────────
// 玩家回合开始时偷能量；玩家抽牌时获得格挡
export const time_thief = {
  id: 'time_thief',
  display: { name: '时间窃贼' },
  actions: {
    slash: { type: 'attack', desc: '造成 8 点伤害。' },
  },
  hooks: {
    'event:enemy:action': `
      State.emit('entity:attack', { target='player', amount=8, source=Ctx.self, action=Event.action })
    `,
    'event:enemy:update': `
      State.set('battle', 'entities', Ctx.self, 'intent', 'slash')
    `,
    'event:player:turn:start': {
      script: `
        local energy = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'energy') or 0
        if energy > 0 then
          State.set(${BATTLE_ENTITIES_PATH}, 'player', 'energy', energy - 1)
        end
      `,
    },
    'event:card:move': {
      script: `
        if Event.to ~= 'hand' then return end
        State.emit('entity:block', { target = Ctx.self, amount = 2 })
      `,
    },
  },
}

// ── 洗牌恶魔 ─────────────────────────────────────────────────────────────────
// 玩家洗牌时获得力量；低血量时双重攻击
export const shuffle_demon = {
  id: 'shuffle_demon',
  display: { name: '洗牌恶魔' },
  actions: {
    slam:        { type: 'attack', desc: '造成 10 点伤害。' },
    double_slam: { type: 'attack', desc: '造成 10 点伤害，连续两次。' },
  },
  hooks: {
    'event:enemy:action': `
      local intent = State.get('battle', 'entities', Ctx.self, 'intent')
      local times = (intent == 'double_slam') and 2 or 1
      for i = 1, times do
        State.emit('entity:attack', { target='player', amount=10, source=Ctx.self, action=intent })
        if State.get('battle') == nil then return end
      end
    `,
    'event:enemy:update': `
      if Event.cause == 'init' then
        State.set('battle', 'entities', Ctx.self, 'intent', 'slam')
        return
      end
      local hp = State.get('battle', 'entities', Ctx.self, 'hp') or 0
      local maxHp = State.get('battle', 'entities', Ctx.self, 'maxHp') or 1
      if hp / maxHp < 0.5 then
        State.set('battle', 'entities', Ctx.self, 'intent', 'double_slam')
      else
        State.set('battle', 'entities', Ctx.self, 'intent', 'slam')
      end
    `,
    'event:deck:deplete': {
      script: `
        State.emit('status:apply', { target = Ctx.self, typeId = 'strength', stacks = 3 })
      `,
    },
  },
}
