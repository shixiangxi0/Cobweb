/**
 * rules/turn.js — 回合生命周期规则
 */

import {
  BATTLE_ENTITIES_PATH,
  BATTLE_HAND_PATH,
  BATTLE_CARDS_PATH,
  BATTLE_TURN_PATH,
  BATTLE_ENEMIES_PATH,
} from '../bindings/config.js'

// ── player:turn:start ────────────────────────────────────────────────────────

export const playerTurnStartCore = {
  id: 'core:player:turn:start',
  hooks: { 'event:player:turn:start': `
State.set(${BATTLE_ENTITIES_PATH}, 'player', 'energy', State.get(${BATTLE_ENTITIES_PATH}, 'player', 'maxEnergy') or 0)
local n = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'drawPerTurn') or 5
for i = 1, n do
  State.emit('card:draw', {})
end
` },
};

export const turnCounterCore = {
  id: 'core:turn:counter',
  hooks: { 'event:player:turn:start': { order: 1000, script: `
State.set(${BATTLE_TURN_PATH}, (State.get(${BATTLE_TURN_PATH}) or 0) + 1)
` } },
};

// ── player:turn:end ──────────────────────────────────────────────────────────

export const playerTurnEndCore = {
  id: 'core:player:turn:end',
  hooks: { 'event:player:turn:end': `
for _, iid in ipairs(State.get(${BATTLE_HAND_PATH}) or {}) do
  State.emit('card:system:move', { from = 'hand', to = 'discardPile', instanceId = iid, cardId = State.get(${BATTLE_CARDS_PATH}, iid, 'cardId') })
end
` },
};

// ── actor:turn:bridge ────────────────────────────────────────────────────────

export const actorTurnBridgeCore = {
  id: 'core:actor:turn:bridge',
  hooks: {
    'event:player:turn:start': { order: 1000, script: `
State.emit('actor:turn:start', { target = 'player' })
` },
    'event:player:turn:end': { order: 1000, script: `
State.emit('actor:turn:end', { target = 'player' })
` },
  },
};

// ── turn:sequence ────────────────────────────────────────────────────────────

export const turnSequenceCore = {
  id: 'core:turn:sequence',
  hooks: { 'event:turn:end': `
local function battleOver() return State.get('phase') ~= 'battle' end
local function getEnemyId(slot)
  return State.get(${BATTLE_ENEMIES_PATH}, tostring(slot))
end
local function enemySlots()
  local slots = {}
  for slot = 1, 10 do
    if State.get(${BATTLE_ENEMIES_PATH}, tostring(slot)) ~= nil then
      table.insert(slots, slot)
    end
  end
  return slots
end

State.emit('player:turn:end', {})
if battleOver() then return end

for _, slot in ipairs(enemySlots()) do
    if battleOver() then return end
    local eid = getEnemyId(slot)
    if eid ~= nil then
      State.emit('actor:turn:start', { target = eid })
      if battleOver() then return end
      local intent = State.get(${BATTLE_ENTITIES_PATH}, eid, 'intent')
      if intent then
        State.emit('enemy:action', { target = eid, action = intent })
      end
    if battleOver() then return end
    if getEnemyId(slot) ~= nil then
      State.emit('enemy:update', { target = eid, cause = 'turn' })
      State.emit('actor:turn:end', { target = eid })
    end
  end
end

if battleOver() then return end

State.emit('player:turn:start', {})
` },
};
