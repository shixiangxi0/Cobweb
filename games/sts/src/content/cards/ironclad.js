/**
 * modules/cards/ironclad.js — 铁甲战士基础牌组
 *
 * 卡牌模块字段规范：
 *   id         — 唯一键，与 ALL_CARD_DEFS key 一致（snake_case）
 *   cost       — 能量消耗：0/1/2/3 = 固定；-1 = X 费（引擎不扣，脚本自管能量）
 *   targetType — 纯 UI：'enemy' | 'none' | 'all_enemies'
 *   exhaust    — 可选，默认 false；true = 打出后移入消耗堆
 *   display    — 纯 UI：{ name, type, desc }
 *   hooks      — 统一 hook 表；卡牌主要使用 'event:<eventName>'
 */
import {
  BATTLE_CARDS_PATH,
  BATTLE_ENEMIES_PATH,
  BATTLE_ENTITIES_PATH,
  BATTLE_HAND_PATH,
} from '../../bindings/config.js'

// ── 打击 ──────────────────────────────────────────────────────────────────────
export const strike = {
  id: 'strike', cost: 1, targetType: 'enemy',
  display: { name: '打击', type: 'attack', desc: '造成 6 点伤害。' },
  hooks: { 'event:card:effect': `
State.emit('entity:attack', { target = Event.target, amount = 6, source = 'player' })
` },
};

// ── 防御 ──────────────────────────────────────────────────────────────────────
export const defend = {
  id: 'defend', cost: 1, targetType: 'none',
  display: { name: '防御', type: 'skill', desc: '获得 5 点格挡。' },
  hooks: { 'event:card:effect': `
State.emit('entity:block', { target = 'player', amount = 5 })
` },
};

// ── 重击 ──────────────────────────────────────────────────────────────────────
export const bash = {
  id: 'bash', cost: 2, targetType: 'enemy',
  display: { name: '重击', type: 'attack', desc: '造成 8 点伤害。施加 2 层易伤。' },
  hooks: { 'event:card:effect': `
State.emit('entity:attack', { target = Event.target, amount = 8, source = 'player' })
State.emit('status:apply', { target = Event.target, typeId = 'vulnerable', stacks = 2 })
` },
};

// ── 铁波 ──────────────────────────────────────────────────────────────────────
export const ironWave = {
  id: 'iron_wave', cost: 1, targetType: 'enemy',
  display: { name: '铁波', type: 'attack', desc: '获得 5 点格挡。造成 5 点伤害。' },
  hooks: { 'event:card:effect': `
State.emit('entity:block', { target = 'player', amount = 5 })
State.emit('entity:attack', { target = Event.target, amount = 5, source = 'player' })
` },
};

// ── 旋风斩 ────────────────────────────────────────────────────────────────────
export const whirlwind = {
  id: 'whirlwind', cost: -1, targetType: 'all_enemies',  // cost: -1 = X 费
  display: { name: '旋风斩', type: 'attack', desc: '对所有敌人造成 X×5 点伤害（X = 消耗能量）。' },
  hooks: { 'event:card:effect': `
local x = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'energy') or 0
State.set(${BATTLE_ENTITIES_PATH}, 'player', 'energy', 0)
for slot = 1, 10 do
  local eid = State.get(${BATTLE_ENEMIES_PATH}, tostring(slot))
  if eid ~= nil then
    for i = 1, x do
      State.emit('entity:attack', { target = eid, amount = 5, source = 'player' })
    end
  end
end
` },
};

// ── 愤怒 ──────────────────────────────────────────────────────────────────────
export const anger = {
  id: 'anger', cost: 0, targetType: 'enemy',
  display: { name: '愤怒', type: 'attack', desc: '造成 6 点伤害。将一张【愤怒】加入弃牌堆。' },
  hooks: { 'event:card:effect': `
State.emit('entity:attack', { target = Event.target, amount = 6, source = 'player' })
State.emit('card:create', { cardId = 'anger', destination = 'discardPile' })
` },
};

// ── 耸耸肩 ────────────────────────────────────────────────────────────────────
export const shrug = {
  id: 'shrug', cost: 1, targetType: 'none',
  display: { name: '耸耸肩', type: 'skill', desc: '获得 8 点格挡。抽 1 张牌。' },
  hooks: { 'event:card:effect': `
State.emit('entity:block', { target = 'player', amount = 8 })
State.emit('card:draw', {})
` },
};

// ── 换手 ────────────────────────────────────────────────────────────────────
export const mulligan = {
  id: 'mulligan', cost: 1, targetType: 'none',
  display: { name: '换手', type: 'skill', desc: '弃掉手牌中其余所有牌。抽等量牌。' },
  hooks: { 'event:card:effect': `
local hand = State.get(${BATTLE_HAND_PATH}) or {}
local toDiscard = {}

for _, iid in ipairs(hand) do
  if iid ~= Event.instanceId then
    table.insert(toDiscard, iid)
  end
end

local redrawCount = #toDiscard
for _, iid in ipairs(toDiscard) do
  State.emit('card:discard', {
    instanceId = iid,
    cardId = State.get(${BATTLE_CARDS_PATH}, iid, 'cardId'),
  })
end

for i = 1, redrawCount do
  State.emit('card:draw', {})
end
` },
};

// ── 力量药剂（power 牌示例）─────────────────────────────────────────────────
export const inflame = {
  id: 'inflame', cost: 1, targetType: 'none',
  display: { name: '燃烧', type: 'power', desc: '获得 2 层力量。' },
  hooks: { 'event:card:effect': `
State.emit('status:apply', { target = 'player', typeId = 'strength', stacks = 2 })
` },
};

// ── 好奇心（当被抽到时获得力量）──────────────────────────────────────────────
export const curiosity = {
  id: 'curiosity', cost: 1, targetType: 'none',
  display: { name: '好奇心', type: 'skill', desc: '抽到此牌时，获得 1 层力量。打出：拥抱未知（随机弃一张手牌）。' },
  hooks: {
    // 被抽到时触发：进入手牌时获得 1 层力量
    'event:card:move': {
      script: `
        if Event.to ~= 'hand' then return end
        State.emit('status:apply', { target = 'player', typeId = 'strength', stacks = 1 })
      `,
    },
    // 打出时：弃掉一张随机手牌（若有）
    'event:card:effect': `
local hand = State.get(${BATTLE_HAND_PATH}) or {}
-- hand 是 instanceId 字符串数组，弃除自身外的第一张
for _, iid in ipairs(hand) do
  if iid ~= Event.instanceId then
    State.emit('card:discard', { instanceId = iid, cardId = State.get(${BATTLE_CARDS_PATH}, iid, 'cardId') })
    break
  end
end
`,
  },
};

// ── 奥术通量（每回合额外抽一张牌，Power 牌）──────────────────────────────────
export const arcaneFlux = {
  id: 'arcane_flux', cost: 1, targetType: 'none',
  exhaust: true,
  display: { name: '奥术通量', type: 'power', desc: '每回合开始额外抽 1 张牌。' },
  hooks: { 'event:card:effect': `
State.emit('status:apply', { target = 'player', typeId = 'extra_draw', stacks = 1 })
` },
};

// ── 祭品（花血换能量）─────────────────────────────────────────────────────────
export const offering = {
  id: 'offering', cost: 0, targetType: 'none',
  exhaust: true,
  display: { name: '祭品', type: 'skill', desc: '失去 6 点 HP（穿透格挡）。获得 3 点能量。抽 3 张牌。' },
  hooks: { 'event:card:effect': `
-- 穿透格挡失去 HP，source='offering' 供 rupture 等状态识别「主动失血」
local hp = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'hp') or 0
local loss = math.min(6, hp)
if loss > 0 then
  State.emit('entity:loss', { target = 'player', amount = loss, source = 'offering', direct = true })
end
State.set(${BATTLE_ENTITIES_PATH}, 'player', 'energy', (State.get(${BATTLE_ENTITIES_PATH}, 'player', 'energy') or 0) + 3)
for i = 1, 3 do State.emit('card:draw', {}) end
` },
};

// ── 撕裂（获得 rupture 状态）──────────────────────────────────────────────────
export const ruptureCard = {
  id: 'rupture', cost: 1, targetType: 'none',
  exhaust: true,
  display: { name: '撕裂', type: 'power', desc: '施加 1 层撕裂状态：每次受到实际 HP 伤害时获得 1 层力量。' },
  hooks: { 'event:card:effect': `
State.emit('status:apply', { target = 'player', typeId = 'rupture', stacks = 1 })
` },
};

// ── 极限突破（翻倍力量）────────────────────────────────────────────────────────
export const limitBreak = {
  id: 'limit_break', cost: 1, targetType: 'none',
  exhaust: true,
  display: { name: '极限突破', type: 'skill', desc: '将你的力量翻倍。' },
  hooks: { 'event:card:effect': `
local str = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'statuses', 'strength', 'stacks') or 0
if str > 0 then
  State.emit('status:apply', { target = 'player', typeId = 'strength', stacks = str })
end
` },
};

// ── 肉搏（格挡转化为伤害）──────────────────────────────────────────────────────
export const bodySlam = {
  id: 'body_slam', cost: 1, targetType: 'enemy',
  display: { name: '肉搏', type: 'attack', desc: '造成等同于当前格挡量的伤害。' },
  hooks: { 'event:card:effect': `
local block = State.get(${BATTLE_ENTITIES_PATH}, 'player', 'statuses', 'block', 'stacks') or 0
State.emit('entity:attack', { target = Event.target, amount = block, source = 'player' })
` },
};

// ── 恶魔化（Power：每回合开始获得 3 层力量）────────────────────────────────────
export const demonFormCard = {
  id: 'demon_form', cost: 3, targetType: 'none',
  exhaust: true,
  display: { name: '恶魔化', type: 'power', desc: '每回合开始获得 3 层力量。' },
  hooks: { 'event:card:effect': `
State.emit('status:apply', { target = 'player', typeId = 'demon_form', stacks = 1 })
` },
};

// ── 冲击波（全体 + 虚弱）────────────────────────────────────────────────────────
export const shockwave = {
  id: 'shockwave', cost: 2, targetType: 'all_enemies',
  exhaust: true,
  display: { name: '冲击波', type: 'skill', desc: '对所有敌人造成 6 点伤害并施加 3 层虚弱。' },
  hooks: { 'event:card:effect': `
for slot = 1, 10 do
  local eid = State.get('battle', 'enemies', tostring(slot))
  if eid ~= nil and (State.get('battle', 'entities', eid, 'hp') or 0) > 0 then
    State.emit('entity:attack', { target = eid, amount = 6, source = 'player' })
    State.emit('status:apply', { target = eid, typeId = 'weak', stacks = 3 })
  end
end
` },
};

// ── 裂击（对所有敌人造成伤害）────────────────────────────────────────────────
export const cleave = {
  id: 'cleave', cost: 1, targetType: 'none',
  display: { name: '裂击', type: 'attack', desc: '对所有敌人造成 8 点伤害。' },
  hooks: { 'event:card:effect': `
for slot = 1, 10 do
  local eid = State.get('battle', 'enemies', tostring(slot))
  if eid ~= nil and (State.get('battle', 'entities', eid, 'hp') or 0) > 0 then
    State.emit('entity:attack', { target = eid, amount = 8, source = 'player' })
  end
end
` },
};

// ── 死神镰（AOE + 治疗等量实际伤害）─────────────────────────────────────────
export const reaper = {
  id: 'reaper', cost: 2, targetType: 'none',
  exhaust: true,
  display: { name: '死神镰', type: 'attack', desc: '对所有敌人造成 4 点伤害，并治疗等同于实际造成伤害的 HP。' },
  hooks: {
    // card:effect：向所有敌人发出伤害
    // source='player' 保证 strength/weak 状态正常生效
    'event:card:effect': `
for slot = 1, 10 do
  local eid = State.get('battle', 'enemies', tostring(slot))
  if eid ~= nil and (State.get('battle', 'entities', eid, 'hp') or 0) > 0 then
    State.emit('entity:attack', { target = eid, amount = 4, source = 'player' })
  end
end
`,
    // entity:loss：在 lossCore(0) 扣完 HP 后、dieEmitter(-9999) 前触发
    // actualLoss = min(净伤, 剩余HP)，击杀时不会多回血
    // 只处理敌人实际失血，排除玩家因荆棘/主动失血造成的 loss
    'event:entity:loss': `
if Event.target == 'player' then return end
local actual = Event.actualLoss or 0
if actual > 0 then
  State.emit('entity:heal', { target = 'player', amount = actual })
end
`,
  },
};

// ── 巩固（将当前格挡翻倍）────────────────────────────────────────────────────
export const entrench = {
  id: 'entrench', cost: 2, targetType: 'none',
  display: { name: '巩固', type: 'skill', desc: '将当前格挡翻倍。' },
  hooks: { 'event:card:effect': `
local block = State.get('battle', 'entities', 'player', 'statuses', 'block', 'stacks') or 0
if block > 0 then
  State.emit('entity:block', { target = 'player', amount = block })
end
` },
};


