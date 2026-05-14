/**
 * rules/card.js — 卡牌规则
 *
 * 事件链：card:play → card:effect → card:move（draw/discard/exhaust）
 */

import {
  BATTLE_CARDS_PATH,
  BATTLE_HAND_PATH,
  BATTLE_DRAW_PILE_PATH,
  BATTLE_DISCARD_PILE_PATH,
  BATTLE_EXHAUST_PILE_PATH,
  BATTLE_ENTITIES_PATH,
} from '../bindings/config.js'

// ── card:play ────────────────────────────────────────────────────────────────

export const cardPlayCore = {
  id: 'core:card:play',
  hooks: { 'event:card:play': `
local cost = Event.cost or State.get(${BATTLE_CARDS_PATH}, Event.instanceId, 'cost') or 0

if cost >= 0 then
  local energy = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'energy') or 0
  if energy < cost then
    Event.cancelled = true
    return
  end
  State.set(${BATTLE_ENTITIES_PATH}, 'player', 'energy', energy - cost)
end
-- cost < 0：X 费卡，脚本自管能量

-- 引擎已自动绑定卡牌实例；card:effect 自动路由到对应 instanceId
State.emit('card:effect', {
  instanceId = Event.instanceId,
  cardId     = Event.cardId,
  target     = Event.target,
})
` },
};

export const cardPlayCleanupCore = {
  id: 'core:card:play:cleanup',
  hooks: { 'event:card:play': { order: -400, script: `
if Event.cancelled then return end
if State.get('battle') == nil then return end
local exhaust  = State.get(${BATTLE_CARDS_PATH}, Event.instanceId, 'exhaust')
local ethereal = State.get(${BATTLE_CARDS_PATH}, Event.instanceId, 'ethereal')
if exhaust or ethereal then
  State.emit('card:exhaust', {
    instanceId = Event.instanceId,
    cardId     = Event.cardId,
  })
else
  State.emit('card:system:move', {
    from       = 'hand',
    to         = 'discardPile',
    instanceId = Event.instanceId,
    cardId     = Event.cardId,
  })
end
` } },
};

// ── card:move（底层原语）─────────────────────────────────────────────────────

const RELOCATE_SCRIPT = `
local iid = Event.instanceId
if not iid then return end

local function getZone(zone)
  if zone == 'drawPile' then return State.get(${BATTLE_DRAW_PILE_PATH}) or {} end
  if zone == 'hand' then return State.get(${BATTLE_HAND_PATH}) or {} end
  if zone == 'discardPile' then return State.get(${BATTLE_DISCARD_PILE_PATH}) or {} end
  if zone == 'exhaustPile' then return State.get(${BATTLE_EXHAUST_PILE_PATH}) or {} end
  return State.get(zone) or {}
end

local function setZone(zone, value)
  if zone == 'drawPile' then State.set(${BATTLE_DRAW_PILE_PATH}, value); return end
  if zone == 'hand' then State.set(${BATTLE_HAND_PATH}, value); return end
  if zone == 'discardPile' then State.set(${BATTLE_DISCARD_PILE_PATH}, value); return end
  if zone == 'exhaustPile' then State.set(${BATTLE_EXHAUST_PILE_PATH}, value); return end
  State.set(zone, value)
end

if Event.from then
  local src = getZone(Event.from)
  local newSrc = {}
  for _, c in ipairs(src) do
    if c ~= iid then table.insert(newSrc, c) end
  end
  setZone(Event.from, newSrc)
end

if Event.to then
  local dst = getZone(Event.to)
  local newDst = {}
  for _, c in ipairs(dst) do table.insert(newDst, c) end
  table.insert(newDst, iid)
  setZone(Event.to, newDst)
end
`;

export const cardMoveCore = {
  id: 'core:card:move',
  hooks: { 'event:card:move': { order: 1000, script: RELOCATE_SCRIPT } },
};

export const cardSystemMoveCore = {
  id: 'core:card:system:move',
  hooks: { 'event:card:system:move': { order: 1000, script: RELOCATE_SCRIPT } },
};

// ── card:draw ────────────────────────────────────────────────────────────────

export const cardDrawCore = {
  id: 'core:card:draw',
  hooks: { 'event:card:draw': `
local drawPile = State.get(${BATTLE_DRAW_PILE_PATH}) or {}
if #drawPile == 0 then
  State.emit('deck:deplete', {})
  drawPile = State.get(${BATTLE_DRAW_PILE_PATH}) or {}
  if #drawPile == 0 then return end
end

local iid = drawPile[1]
local cardId = State.get(${BATTLE_CARDS_PATH}, iid, 'cardId')
State.emit('card:move', {
  from         = 'drawPile',
  to           = 'hand',
  instanceId   = iid,
  cardId       = cardId,
})
` },
};

// ── card:discard ─────────────────────────────────────────────────────────────

export const cardDiscardCore = {
  id: 'core:card:discard',
  hooks: { 'event:card:discard': `
State.emit('card:move', {
  from         = Event.from or 'hand',
  to           = 'discardPile',
  instanceId   = Event.instanceId,
  cardId       = Event.cardId,
})
` },
};

// ── card:exhaust ─────────────────────────────────────────────────────────────

export const cardExhaustCore = {
  id: 'core:card:exhaust',
  hooks: { 'event:card:exhaust': `
State.emit('card:move', {
  from       = Event.from or 'hand',
  to         = 'exhaustPile',
  instanceId = Event.instanceId,
  cardId     = Event.cardId,
  reason     = Event.reason,
})
` },
};

// ── card:create ──────────────────────────────────────────────────────────────

export const cardCreateCore = {
  id: 'core:card:create',
  hooks: { 'event:card:create': `
local cardId  = Event.cardId
if not cardId then return end
local cardCount = #(State.keys(${BATTLE_CARDS_PATH}) or {})
local attempt = 0
local iid = nil
repeat
  attempt = attempt + 1
  local seed = ScenarioSeed + State.hashString('card_create_' .. cardId .. '_' .. tostring(cardCount + 1) .. '_' .. tostring(attempt))
  iid = cardId .. '_' .. tostring(State.random(seed, 1, 100000, 999999)[1])
until State.get(${BATTLE_CARDS_PATH}, iid) == nil
local cardDef = Defs.card and Defs.card[cardId]
local inst    = { cardId = cardId }
if cardDef then
  local cost       = cardDef.cost
  local exhaust    = cardDef.exhaust
  local targetType = cardDef.targetType
  if cost       ~= nil then inst.cost       = cost       end
  if exhaust         then inst.exhaust    = exhaust    end
  if targetType ~= nil then inst.targetType = targetType end
end
State.set(${BATTLE_CARDS_PATH}, iid, inst)
State.emit('card:move', { to = Event.destination, instanceId = iid, cardId = cardId })
Event.instanceId = iid
` },
};
