/**
 * rules/combat.js — 战斗实体规则
 *
 * 事件链：entity:attack → entity:damage → entity:loss → entity:die
 */

import {
  BATTLE_ENTITIES_PATH,
  BATTLE_ENEMIES_PATH,
} from '../bindings/config.js'

// ── entity:attack ────────────────────────────────────────────────────────────

export const attackTargetGuardCore = {
  id: 'core:entity:attack:target-guard',
  hooks: { 'event:entity:attack': { order: 1000, script: `
local hp = State.get(${BATTLE_ENTITIES_PATH}, Event.target, 'hp')
if hp == nil or hp <= 0 then
  Event.cancelled = true
  return
end
` } },
};

export const attackCore = {
  id: 'core:entity:attack',
  hooks: { 'event:entity:attack': `
State.emit('entity:damage', {
  target      = Event.target,
  amount      = Event.amount,
  source      = Event.source,
  action      = Event.action,
  cardId      = Event.cardId,
  instanceId  = Event.instanceId,
  meta        = Event.meta,
})
` },
};

// ── entity:damage ────────────────────────────────────────────────────────────

export const damageCore = {
  id: 'core:entity:damage',
  hooks: { 'event:entity:damage': `
local rawBlock = State.get(${BATTLE_ENTITIES_PATH}, Event.target, 'statuses', 'block', 'stacks') or 0
local blocked  = math.min(rawBlock, Event.amount)
local net      = Event.amount - blocked

if blocked > 0 then
  State.emit('entity:block', { target = Event.target, amount = -blocked })
end

Event.actualDamage = net
Event.blocked      = blocked
` },
};

export const damageLossCore = {
  id: 'core:entity:damage:loss',
  hooks: { 'event:entity:damage': { order: -9999, script: `
local net = Event.actualDamage or 0
if net > 0 then
  State.emit('entity:loss', {
    target     = Event.target,
    amount     = net,
    source     = Event.source,
    action     = Event.action,
    cardId     = Event.cardId,
    instanceId = Event.instanceId,
    direct     = Event.direct,
    meta       = Event.meta,
  })
end
` } },
};

// ── entity:loss ──────────────────────────────────────────────────────────────

export const lossCore = {
  id: 'core:entity:loss',
  hooks: { 'event:entity:loss': `
local cur     = State.get(${BATTLE_ENTITIES_PATH}, Event.target, 'hp') or 0
local loss    = math.min(Event.amount, cur)
local finalHp = cur - loss
State.set(${BATTLE_ENTITIES_PATH}, Event.target, 'hp', finalHp)
Event.actualLoss = loss
Event.isFatal    = loss > 0 and finalHp <= 0
` },
};

export const entityDieEmitterCore = {
  id: 'core:entity:die:emitter',
  hooks: { 'event:entity:loss': { order: -9999, script: `
if Event.isFatal then
  State.emit('entity:die', { target = Event.target })
end
` } },
};

// ── entity:die ───────────────────────────────────────────────────────────────

export const entityDieCore = {
  id: 'core:entity:die',
  hooks: { 'event:entity:die': `
if Event.target == 'player' then
  State.emit('battle:end', { victory = false })
  return
end
-- 引擎自动解绑死亡敌人
State.emit('enemy:die', { target = Event.target })
-- 找到并清除对应 slot
for slot = 1, 10 do
  local eid = State.get(${BATTLE_ENEMIES_PATH}, tostring(slot))
  if eid ~= nil and eid == Event.target then
    State.set(${BATTLE_ENEMIES_PATH}, tostring(slot), nil)
    break
  end
end

-- （清除 slot 后，存活 slot 为空则胜利）
local hasLiving = false
for slot = 1, 10 do
  if State.get(${BATTLE_ENEMIES_PATH}, tostring(slot)) ~= nil then
    hasLiving = true
    break
  end
end
if not hasLiving then
  State.emit('battle:end', { victory = true })
end
` },
};

// ── entity:heal ──────────────────────────────────────────────────────────────

export const healCore = {
  id: 'core:entity:heal',
  hooks: { 'event:entity:heal': `
local cur   = State.get(${BATTLE_ENTITIES_PATH}, Event.target, 'hp')    or 0
local maxHp = State.get(${BATTLE_ENTITIES_PATH}, Event.target, 'maxHp') or cur
State.set(${BATTLE_ENTITIES_PATH}, Event.target, 'hp', math.min(maxHp, cur + Event.amount))
` },
};

// ── entity:block ─────────────────────────────────────────────────────────────

export const blockCore = {
  id: 'core:entity:block',
  hooks: { 'event:entity:block': `
State.emit('status:apply', { target = Event.target, typeId = 'block', stacks = Event.amount })
` },
};
