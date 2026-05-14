/**
 * rules/flow.js — 游戏流程规则
 *
 * 覆盖 battle 开始/结束、victory/defeat、reward/shop 流转、flow:advance。
 */

import {
  BATTLE_ENEMIES_PATH,
  BATTLE_ENTITIES_PATH,
} from '../bindings/config.js'

// ── battle:start ─────────────────────────────────────────────────────────────

export const battleStartCore = {
  id: 'core:battle:start',
  hooks: { 'event:battle:start': `
State.emit('phase:enter', { phase = 'battle' })
-- 引擎自动绑定所有敌人；此处只需刷新初始 intent
for slot = 1, 10 do
  local eid = State.get(${BATTLE_ENEMIES_PATH}, tostring(slot))
  if eid ~= nil then
    State.emit('enemy:update', { target = eid, cause = 'init' })
  end
end
State.emit('player:turn:start', {})
` },
};

// ── battle:end ───────────────────────────────────────────────────────────────

export const battleEndCore = {
  id: 'core:battle:end',
  hooks: { 'event:battle:end': `
if Event.victory then
  State.emit('flow:victory', {})
else
  State.emit('flow:defeat', {})
end
` },
};

// ── flow:victory ─────────────────────────────────────────────────────────────

const PHASE_EXIT_HELPERS = `
local function copyExitTail(exits)
  local tail = {}
  for index = 2, #(exits or {}) do
    table.insert(tail, exits[index])
  end
  if #tail == 0 then return nil end
  return tail
end

local function emitNextPhaseExit(exits, rewardPayload)
  local nextPhase = exits and exits[1] or nil
  local tail = copyExitTail(exits)

  if nextPhase == 'reward' then
    local payload = rewardPayload or {}
    payload.afterReward = tail
    State.emit('reward:open', payload)
    return
  end

  if nextPhase == 'shop' then
    State.emit('shop:enter', { afterShop = tail })
    return
  end

  State.emit('flow:advance', {})
end
`;

export const flowVictoryCore = {
  id: 'core:flow:victory',
  hooks: { 'event:flow:victory': { order: 100, script: `
    ${PHASE_EXIT_HELPERS}
    local afterBattle = State.get('battle', 'afterBattle') or {}

    -- 计算金币奖励（在清除 battle 前读取敌人配置）
    local entities = State.get('battle', 'entities') or {}
    local entityIds = State.keys('battle', 'entities') or {}
    local goldReward = 0
    for _, eid in ipairs(entityIds) do
      if eid ~= 'player' then
        local entity = entities[eid]
        local def = Defs.enemy[entity and entity.typeId]
        if def and def.rewards then
          goldReward = goldReward + (def.rewards.gold or 0)
        end
      end
    end

    -- 引擎自动清理敌人 binding；此处只需持久化玩家状态
    -- leave battle: persist player, clear temporary battle state
    State.emit('run:player:sync', {})
    State.set('battle', nil)

    -- 守卫：防止多个敌人死亡时重复触发
    local currentPhase = State.get('phase')
    local reward = State.get('reward')
    local shop = State.get('shop')
    if reward or shop or currentPhase == 'defeat' then
      return
    end

    emitNextPhaseExit(afterBattle, { goldReward = goldReward })
  ` } },
};

// ── defeat ───────────────────────────────────────────────────────────────────

export const defeatEnterCore = {
  id: 'core:defeat:enter',
  hooks: { 'event:defeat:enter': { order: 100, script: `
    State.emit('phase:enter', { phase = 'defeat' })
  ` } },
};

export const flowDefeatCore = {
  id: 'core:flow:defeat',
  hooks: { 'event:flow:defeat': { order: 100, script: `
    -- 守卫：防止多个敌人死亡时重复触发
    local currentPhase = State.get('phase')
    if currentPhase == 'defeat' then return end

    local entities = State.get('battle', 'entities') or {}
    local entityIds = State.keys('battle', 'entities') or {}
    -- 引擎自动清理敌人 binding
    State.emit('run:player:sync', {})
    State.set('battle', nil)
    State.emit('defeat:enter', {})
  ` } },
};

// ── reward flow ──────────────────────────────────────────────────────────────

export const rewardClaimFlowCore = {
  id: 'core:flow:reward:claim',
  hooks: { 'event:reward:claim': { order: -100, script: `
    ${PHASE_EXIT_HELPERS}
    if Event.cancelled then return end

    -- flush claimed reward into run before leaving
    local reward = State.get('reward')
    local claimed = reward and reward.claimed or nil
    if claimed then
      if claimed.kind == 'gold' then
        local gold = State.get('run', 'gold') or 0
        State.set('run', 'gold', gold + (claimed.amount or 0))
      elseif claimed.kind == 'card' then
        local deck = State.get('run', 'deck') or {}
        table.insert(deck, { cardId = claimed.cardId, upgrades = 0 })
        State.set('run', 'deck', deck)
      elseif claimed.kind == 'relic' then
        State.emit('relic:acquire', { relicId = claimed.relicId })
      end
    end

    local afterReward = State.get('reward', 'afterReward') or {}
    State.set('reward', nil)

    emitNextPhaseExit(afterReward, {})
  ` } },
};

export const rewardSkipFlowCore = {
  id: 'core:flow:reward:skip',
  hooks: { 'event:reward:skip': { order: -100, script: `
    ${PHASE_EXIT_HELPERS}
    if Event.cancelled then return end
    local afterReward = State.get('reward', 'afterReward') or {}
    State.set('reward', nil)

    emitNextPhaseExit(afterReward, {})
  ` } },
};

// ── shop flow ────────────────────────────────────────────────────────────────

export const shopLeaveFlowCore = {
  id: 'core:flow:shop:leave',
  hooks: { 'event:shop:leave': { order: -100, script: `
    ${PHASE_EXIT_HELPERS}
    if Event.cancelled then return end

    emitNextPhaseExit(Event.afterShop or {}, {})
  ` } },
};

// ── flow:advance ─────────────────────────────────────────────────────────────

export const flowAdvanceCore = {
  id: 'core:flow:advance',
  hooks: { 'event:flow:advance': `
local progress = State.get('run', 'progress') or {}
local nextIndex = (progress.floorIndex or 0) + 1
local floorCount = progress.floorCount or 0

State.set('run', 'progress', 'floorIndex', nextIndex)

if nextIndex >= floorCount then
  State.set('run', 'progress', 'completed', true)
end
` },
};

export const phaseEnterCore = {
  id: 'core:phase:enter',
  hooks: { 'event:phase:enter': `State.set('phase', Event.phase)` },
};
