/**
 * content/cards/hook_driven.js — 事件驱动卡牌
 *
 * 每张牌都深度利用 evt-core 的事件 hook 系统，单卡即可展现复杂机制。
 */

import {
  BATTLE_ENTITIES_PATH,
  BATTLE_HAND_PATH,
  BATTLE_CARDS_PATH,
  BATTLE_ENEMIES_PATH,
} from '../../bindings/config.js'

// ── 全局规则：本回合洗牌次数追踪 ────────────────────────────────────────────
export const shuffleTrackerCore = {
  id: 'core:shuffle:tracker',
  hooks: {
    'event:deck:deplete': {
      order: 1000,
      script: `
        State.set('battle', 'shuffle_count', (State.get('battle', 'shuffle_count') or 0) + 1)
      `,
    },
    'event:player:turn:start': {
      order: 1000,
      script: `
        State.set('battle', 'shuffle_count', 0)
      `,
    },
  },
}

// ── 1. 混沌赌局 ─────────────────────────────────────────────────────────────
export const chaosGamble = {
  id: 'chaos_gamble', cost: 0, targetType: 'none',
  display: { name: '混沌赌局', type: 'skill', desc: '将手牌中所有牌的费用随机化为 0-3。每有一张变为 0 费，抽 1 张牌。' },
  hooks: { 'event:card:effect': `
    local hand = State.get(${BATTLE_HAND_PATH}) or {}
    local drawn = 0
    for _, iid in ipairs(hand) do
      if iid ~= Event.instanceId then
        local newCost = State.random(ScenarioSeed + State.hashString('chaos_gamble_' .. Event.instanceId .. '_' .. iid), 1, 0, 3)[1]
        State.set(${BATTLE_CARDS_PATH}, iid, 'cost', newCost)
        if newCost == 0 then
          drawn = drawn + 1
        end
      end
    end
    for i = 1, drawn do
      State.emit('card:draw', {})
    end
  ` },
}

// ── 2. 时间回响 ─────────────────────────────────────────────────────────────
export const timeEcho = {
  id: 'time_echo', cost: 1, targetType: 'none',
  display: { name: '时间回响', type: 'skill', desc: '下回合开始时额外抽 2 张牌。将一张此牌复制到抽牌堆。' },
  hooks: { 'event:card:effect': `
    State.emit('status:apply', { target = 'player', typeId = 'extra_draw', stacks = 2 })
    State.emit('card:create', { cardId = 'time_echo', destination = 'drawPile' })
  ` },
}

// ── 3. 不稳定精华 ───────────────────────────────────────────────────────────
// 被弃置时（回合结束自动弃牌或主动弃牌）对所有敌人造成伤害
export const volatileEssence = {
  id: 'volatile_essence', cost: 0, targetType: 'none',
  display: { name: '不稳定精华', type: 'skill', desc: '获得 3 格挡。此牌被弃置时，对所有敌人造成 3 点伤害。' },
  hooks: {
    'event:card:effect': `
      State.emit('entity:block', { target = 'player', amount = 3 })
    `,
    'event:card:move': {
      script: `
        if Event.to ~= 'discardPile' then return end
        for slot = 1, 10 do
          local eid = State.get(${BATTLE_ENEMIES_PATH}, tostring(slot))
          if eid ~= nil and (State.get('battle', 'entities', eid, 'hp') or 0) > 0 then
            State.emit('entity:attack', { target = eid, amount = 3, source = 'player' })
          end
        end
      `,
    },
  },
}

// ── 4. 蓄力抽牌 ─────────────────────────────────────────────────────────────
// 抽到时立即获得力量（通过 card:drawn 事件）
export const drawStrength = {
  id: 'draw_strength', cost: 1, targetType: 'none',
  display: { name: '蓄力抽牌', type: 'skill', desc: '抽到此牌时获得 2 层力量。打出时抽 2 张牌。' },
  hooks: {
    'event:card:move': {
      script: `
        if Event.to ~= 'hand' then return end
        State.emit('status:apply', { target = 'player', typeId = 'strength', stacks = 2 })
      `,
    },
    'event:card:effect': `
      State.emit('card:draw', {})
      State.emit('card:draw', {})
    `,
  },
}

// ── 5. 洗牌爆破 ─────────────────────────────────────────────────────────────
// 本回合每洗牌一次，额外造成 6 点伤害
export const shuffleBlast = {
  id: 'shuffle_blast', cost: 2, targetType: 'enemy',
  display: { name: '洗牌爆破', type: 'attack', desc: '造成 6 点伤害。本回合每洗牌一次，额外造成 6 点伤害。' },
  hooks: { 'event:card:effect': `
    local shuffleCount = State.get('battle', 'shuffle_count') or 0
    local totalHits = shuffleCount + 1
    for i = 1, totalHits do
      State.emit('entity:attack', { target = Event.target, amount = 6, source = 'player' })
    end
  ` },
}

// ── 6. 弃焰 ─────────────────────────────────────────────────────────────────
// 被弃置时对所有敌人造成伤害
export const discardFlame = {
  id: 'discard_flame', cost: 1, targetType: 'enemy',
  display: { name: '弃焰', type: 'attack', desc: '造成 5 点伤害。此牌被弃置时对所有敌人造成 3 点伤害。' },
  hooks: {
    'event:card:effect': `
      State.emit('entity:attack', { target = Event.target, amount = 5, source = 'player' })
    `,
    'event:card:move': {
      script: `
        if Event.to ~= 'discardPile' then return end
        for slot = 1, 10 do
          local eid = State.get(${BATTLE_ENEMIES_PATH}, tostring(slot))
          if eid ~= nil and (State.get('battle', 'entities', eid, 'hp') or 0) > 0 then
            State.emit('entity:attack', { target = eid, amount = 3, source = 'player' })
          end
        end
      `,
    },
  },
}

// ── 7. 恢复 ─────────────────────────────────────────────────────────────────
export const restore = {
  id: 'restore', cost: 1, targetType: 'none',
  display: { name: '恢复', type: 'skill', desc: '获得 5 点格挡。恢复 5 点 HP。' },
  hooks: { 'event:card:effect': `
    State.emit('entity:block', { target = 'player', amount = 5 })
    State.emit('entity:heal', { target = 'player', amount = 5 })
  ` },
}

// ── 8. 镜像 ─────────────────────────────────────────────────────────────────
export const mirrorImage = {
  id: 'mirror_image', cost: 2, targetType: 'none',
  display: { name: '镜像', type: 'skill', desc: '复制手牌中费用最高的牌到手牌。' },
  hooks: { 'event:card:effect': `
    local hand = State.get(${BATTLE_HAND_PATH}) or {}
    local maxCost = -1
    local targetIid = nil
    for _, iid in ipairs(hand) do
      if iid ~= Event.instanceId then
        local cost = State.get(${BATTLE_CARDS_PATH}, iid, 'cost') or 0
        if cost > maxCost then
          maxCost = cost
          targetIid = iid
        end
      end
    end
    if targetIid then
      local cardId = State.get(${BATTLE_CARDS_PATH}, targetIid, 'cardId')
      State.emit('card:create', { cardId = cardId, destination = 'hand' })
    end
  ` },
}

// ── 9. 过抽之痛 ─────────────────────────────────────────────────────────────
export const overdrawPain = {
  id: 'overdraw_pain', cost: 0, targetType: 'none',
  display: { name: '过抽之痛', type: 'skill', desc: '抽 3 张牌。若手牌超过 6 张，每超 1 张受 1 点穿透伤害。' },
  hooks: { 'event:card:effect': `
    for i = 1, 3 do
      State.emit('card:draw', {})
    end
    local handSize = #(State.get(${BATTLE_HAND_PATH}) or {})
    if handSize > 6 then
      State.emit('entity:loss', { target = 'player', amount = handSize - 6, source = 'overdraw_pain', direct = true })
    end
  ` },
}

// ── 10. 放血 ────────────────────────────────────────────────────────────────
export const bloodletting = {
  id: 'bloodletting', cost: 0, targetType: 'none',
  display: { name: '放血', type: 'skill', desc: '失去 3 点 HP（穿透）。获得 2 点能量。' },
  hooks: { 'event:card:effect': `
    State.emit('entity:loss', { target = 'player', amount = 3, source = 'bloodletting', direct = true })
    local energy = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'energy') or 0
    State.set(${BATTLE_ENTITIES_PATH}, 'player', 'energy', energy + 2)
  ` },
}
