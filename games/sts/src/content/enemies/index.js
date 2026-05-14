/**
 * content/enemies/index.js — 敌人模块
 *
 * 敌人与 card / status 共用同一套 hooks 机制：
 *   - display: { name } 供 UI 渲染名称
 *   - actions: { [actionId]: { type, amount?, desc } } 纯 UI 数据（意图展示）
 *   - hooks: { 'event:<name>': script | { script, order?, match? } }
 *
 * battle:start 时由 lifecycle 钩子自动绑定（preFire），
 * 无需手动调用 State.bind。
 *
 * 之后由 core 发出敌人控制事件：
 *   enemy:action    payload: { target, action }
 *   enemy:update    payload: { target, cause = 'init' | 'turn' }
 *
 * 受伤阈值、被打反应这类逻辑，通常直接挂在通用事实事件：
 *   entity:loss     payload: { target, actualLoss, source?, action?, ... }
 *
 * 实例过滤由引擎根据 kind='enemy' + ctx.self 自动推断 defaultMatch: { target: 'self' }，
 * 不需要在每个 hook 里手写 match，也不在 Lua 里写 `if Event.target ~= Ctx.self then return end`。
 */

// ── 颚虫 ──────────────────────────────────────────────────────────────────────
export const jaw_worm = {
  id: 'jaw_worm',
  display: { name: '颚虫' },
  actions: {
    bite:   { type: 'attack', desc: '造成 11 点伤害。' },
    thrash: { type: 'attack', desc: '造成 7 点伤害。施加 3 层力量。' },
    bellow: { type: 'defend', desc: '获得 6 点格挡。施加 3 层力量。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'bite' then
  State.emit('entity:attack', { target='player', amount=11, source=Ctx.self, action=a })
elseif a == 'thrash' then
  State.emit('entity:attack', { target='player', amount=7, source=Ctx.self, action=a })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target=Ctx.self, typeId='strength', stacks=3 })
elseif a == 'bellow' then
  State.emit('entity:block', { target=Ctx.self, amount=6 })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target=Ctx.self, typeId='strength', stacks=3 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'bite')
  return
end
local p = State.get('battle', 'entities', Ctx.self, 'phase')
if p == 'low' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'bellow')
  return
end
local cur = State.get('battle', 'entities', Ctx.self, 'intent') or 'bite'
State.set('battle', 'entities', Ctx.self, 'intent', cur == 'bite' and 'thrash' or 'bite')
`,
    'event:entity:loss': `
if Event.isFatal then return end
local pct = (State.get('battle', 'entities', Ctx.self, 'hp') or 0) / (State.get('battle', 'entities', Ctx.self, 'maxHp') or 1)
if pct < 0.3 and State.get('battle', 'entities', Ctx.self, 'phase') ~= 'low' then
  State.set('battle', 'entities', Ctx.self, 'phase', 'low')
end
`,
  },
};

// ── 狂信者 ────────────────────────────────────────────────────────────────────
export const cultist = {
  id: 'cultist',
  display: { name: '狂信者' },
  actions: {
    incantation: { type: 'buff',   desc: '施加 3 层件式（每回合获得 3 层力量）。' },
    dark_strike: { type: 'attack', desc: '造成 6 点伤害。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'incantation' then
  State.emit('status:apply', { target=Ctx.self, typeId='ritual', stacks=3 })
elseif a == 'dark_strike' then
  State.emit('entity:attack', { target='player', amount=6, source=Ctx.self, action=a })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'incantation')
  return
end
State.set('battle', 'entities', Ctx.self, 'intent', 'dark_strike')
`,
  },
};

// ── 赤毒蛞蝓 ──────────────────────────────────────────────────────────────────
export const louse_red = {
  id: 'louse_red',
  display: { name: '赤毒蛞蝓' },
  actions: {
    bite: { type: 'attack', desc: '造成 6 点伤害。' },
    grow: { type: 'buff',   desc: '施加 3 层力量。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'bite' then
  State.emit('entity:attack', { target='player', amount=6, source=Ctx.self, action=a })
elseif a == 'grow' then
  State.emit('status:apply', { target=Ctx.self, typeId='strength', stacks=3 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'bite')
  return
end
local turns = (State.get('battle', 'entities', Ctx.self, 'turns') or 0) + 1
State.set('battle', 'entities', Ctx.self, 'turns', turns)
State.set('battle', 'entities', Ctx.self, 'intent', turns % 3 == 0 and 'grow' or 'bite')
`,
  },
};

// ── 绿毒蛞蝓 ──────────────────────────────────────────────────────────────────
export const louse_green = {
  id: 'louse_green',
  display: { name: '绿毒蛞蝓' },
  actions: {
    bite: { type: 'attack', desc: '造成 6 点伤害。' },
    spit: { type: 'debuff', desc: '施加 1 层虚弱。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'bite' then
  State.emit('entity:attack', { target='player', amount=6, source=Ctx.self, action=a })
elseif a == 'spit' then
  State.emit('status:apply', { target='player', typeId='weak', stacks=1 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'bite')
  return
end
local turns = (State.get('battle', 'entities', Ctx.self, 'turns') or 0) + 1
State.set('battle', 'entities', Ctx.self, 'turns', turns)
State.set('battle', 'entities', Ctx.self, 'intent', turns % 2 == 0 and 'spit' or 'bite')
`,
  },
};

// ── 森狼 ──────────────────────────────────────────────────────────────────────
// 会根据玩家当前是否有格挡决定攻击方式；残血时先嚎叫强化一次。
export const forest_wolf = {
  id: 'forest_wolf',
  display: { name: '森狼' },
  actions: {
    stalk:  { type: 'buff',   desc: '伺机而动：获得 5 点格挡。' },
    rip:    { type: 'attack', desc: '撕扯：造成 8 点伤害。若目标有格挡，再追加 6 点穿透伤害。' },
    pounce: { type: 'attack', desc: '扑杀：造成 12 点伤害，并施加 1 层易伤。' },
    howl:   { type: 'buff',   desc: '战嚎：获得 3 层力量。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'stalk' then
  State.emit('entity:block', { target=Ctx.self, amount=5 })
elseif a == 'rip' then
  local block = State.get('battle', 'entities', 'player', 'statuses', 'block', 'stacks') or 0
  State.emit('entity:attack', { target='player', amount=8, source=Ctx.self, action=a })
  if State.get('battle') == nil then return end
  if block > 0 then
    State.emit('entity:loss', { target='player', amount=6, source=Ctx.self, action=a, direct=true })
  end
elseif a == 'pounce' then
  State.emit('entity:attack', { target='player', amount=12, source=Ctx.self, action=a })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target='player', typeId='vulnerable', stacks=1 })
elseif a == 'howl' then
  State.emit('status:apply', { target=Ctx.self, typeId='strength', stacks=3 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'stalk')
  return
end
if State.get('battle', 'entities', Ctx.self, 'phase') == 'fury' and State.get('battle', 'entities', Ctx.self, 'furyHowled') ~= true then
  State.set('battle', 'entities', Ctx.self, 'furyHowled', true)
  State.set('battle', 'entities', Ctx.self, 'intent', 'howl')
  return
end
local playerBlock = State.get('battle', 'entities', 'player', 'statuses', 'block', 'stacks') or 0
if playerBlock > 0 then
  State.set('battle', 'entities', Ctx.self, 'intent', 'rip')
else
  local cur = State.get('battle', 'entities', Ctx.self, 'intent') or 'stalk'
  State.set('battle', 'entities', Ctx.self, 'intent', cur == 'pounce' and 'stalk' or 'pounce')
end
`,
    'event:entity:loss': `
if Event.isFatal then return end
local pct = (State.get('battle', 'entities', Ctx.self, 'hp') or 0) / (State.get('battle', 'entities', Ctx.self, 'maxHp') or 1)
if pct < 0.5 and State.get('battle', 'entities', Ctx.self, 'phase') ~= 'fury' then
  State.set('battle', 'entities', Ctx.self, 'phase', 'fury')
  State.set('battle', 'entities', Ctx.self, 'furyHowled', false)
end
`,
  },
};

// ── 伏刺蝎 ────────────────────────────────────────────────────────────────────
// 先给玩家挂毒，再根据中毒层数切成穿刺/架壳模式。
export const scorpion_stalker = {
  id: 'scorpion_stalker',
  display: { name: '伏刺蝎' },
  actions: {
    venom_mark: { type: 'debuff', desc: '毒针标记：施加 4 层中毒。' },
    impale:     { type: 'attack', desc: '穿刺：造成 9 点伤害。若目标已有中毒，再追加 5 点穿透伤害。' },
    carapace:   { type: 'defend', desc: '甲壳收束：获得 9 点格挡与 3 层荆棘。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'venom_mark' then
  State.emit('status:apply', { target='player', typeId='poison', stacks=4 })
elseif a == 'impale' then
  local poison = State.get('battle', 'entities', 'player', 'statuses', 'poison', 'stacks') or 0
  State.emit('entity:attack', { target='player', amount=9, source=Ctx.self, action=a })
  if State.get('battle') == nil then return end
  if poison > 0 then
    State.emit('entity:loss', { target='player', amount=5, source=Ctx.self, action=a, direct=true })
  end
elseif a == 'carapace' then
  State.emit('entity:block', { target=Ctx.self, amount=9 })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target=Ctx.self, typeId='thorns', stacks=3 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'venom_mark')
  State.set('battle', 'entities', Ctx.self, 'turns', 0)
  return
end
local turns = (State.get('battle', 'entities', Ctx.self, 'turns') or 0) + 1
State.set('battle', 'entities', Ctx.self, 'turns', turns)
if turns % 3 == 0 then
  State.set('battle', 'entities', Ctx.self, 'intent', 'carapace')
  return
end
local poison = State.get('battle', 'entities', 'player', 'statuses', 'poison', 'stacks') or 0
State.set('battle', 'entities', Ctx.self, 'intent', poison > 0 and 'impale' or 'venom_mark')
`,
  },
};

// ── 诅咒织者 ──────────────────────────────────────────────────────────────────
// 精英怪，开战立即施加契约税 debuff：每出一张牌受 2 点伤害
// 行动模式（三阶段 AI）：
//   HP > 65%：shadow_strike → voodoo → shadow_strike → rejuvenate（循环）
//   HP 35-65%：slam → voodoo → slam → rejuvenate
//   HP < 35%：curse_nova / slam 交替
export const curse_weaver = {
  id: 'curse_weaver',
  display: { name: '诅咒织者' },
  actions: {
    shadow_strike: { type: 'attack', desc: '造成 18 点伤害。' },
    voodoo:        { type: 'debuff', desc: '施加 2 层易伤和 2 层虚弱。' },
    rejuvenate:    { type: 'defend', desc: '获得 24 点格挡，并强化契约税（+1 层）。' },
    slam:          { type: 'attack', desc: '猛力重击，造成 28 点伤害。' },
    curse_nova:    { type: 'debuff', desc: '契约税 +3 层，并造成 10 点 AOE 伤害（包括玩家）。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'shadow_strike' then
  State.emit('entity:attack', { target='player', amount=18, source=Ctx.self, action=a })
elseif a == 'voodoo' then
  State.emit('status:apply', { target='player', typeId='vulnerable', stacks=2 })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target='player', typeId='weak',       stacks=2 })
elseif a == 'rejuvenate' then
  State.emit('entity:block', { target=Ctx.self, amount=24 })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target='player', typeId='card_tax', stacks=1 })
elseif a == 'slam' then
  State.emit('entity:attack', { target='player', amount=28, source=Ctx.self, action=a })
elseif a == 'curse_nova' then
  State.emit('status:apply', { target='player', typeId='card_tax', stacks=3 })
  if State.get('battle') == nil then return end
  State.emit('entity:attack', { target='player', amount=10, source=Ctx.self, action=a })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.emit('status:apply', { target='player', typeId='card_tax', stacks=2 })
  State.set('battle', 'entities', Ctx.self, 'intent', 'shadow_strike')
  State.set('battle', 'entities', Ctx.self, 'turns', 1)
  return
end
local p = State.get('battle', 'entities', Ctx.self, 'phase')
local turns = (State.get('battle', 'entities', Ctx.self, 'turns') or 0) + 1
State.set('battle', 'entities', Ctx.self, 'turns', turns)
local next
if p == 'burst' then
  next = turns % 2 == 1 and 'curse_nova' or 'slam'
elseif p == 'mid' then
  local t = turns % 4
  if     t == 1 then next = 'slam'
  elseif t == 2 then next = 'voodoo'
  elseif t == 3 then next = 'slam'
  else                next = 'rejuvenate'
  end
else
  local t = turns % 4
  if     t == 1 then next = 'shadow_strike'
  elseif t == 2 then next = 'voodoo'
  elseif t == 3 then next = 'shadow_strike'
  else                next = 'rejuvenate'
  end
end
State.set('battle', 'entities', Ctx.self, 'intent', next)
`,
    'event:entity:loss': `
if Event.isFatal then return end
local pct = (State.get('battle', 'entities', Ctx.self, 'hp') or 0) / (State.get('battle', 'entities', Ctx.self, 'maxHp') or 1)
if pct < 0.35 and State.get('battle', 'entities', Ctx.self, 'phase') ~= 'burst' then
  State.set('battle', 'entities', Ctx.self, 'phase', 'burst')
  State.set('battle', 'entities', Ctx.self, 'turns', 0)
elseif pct < 0.65 and State.get('battle', 'entities', Ctx.self, 'phase') == nil then
  State.set('battle', 'entities', Ctx.self, 'phase', 'mid')
  State.set('battle', 'entities', Ctx.self, 'turns', 0)
end
`,
  },
};

// ── 铁甲傀儡 ──────────────────────────────────────────────────────────────────
// 精英怪。开战自带荆棘×8 和金属化×5（每回合末自获 5 格挡）。
// AI 三阶段：HP>60% 交替 slam/fortify；30%~60% 交替 slam/rend；<30% 持续 obliterate
export const iron_golem = {
  id: 'iron_golem',
  display: { name: '铁甲傀儡' },
  actions: {
    slam:       { type: 'attack', desc: '大力碾压，造成 20 点伤害。' },
    fortify:    { type: 'buff',   desc: '自我强化：获得 4 层力量。' },
    rend:       { type: 'attack', desc: '撕裂攻击：造成 14 点伤害，施加 2 层易伤。' },
    obliterate: { type: 'attack', desc: '凶猛暴击：造成 30 点伤害！' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'slam' then
  State.emit('entity:attack', { target='player', amount=20, source=Ctx.self, action=a })
elseif a == 'fortify' then
  State.emit('status:apply', { target=Ctx.self, typeId='strength', stacks=4 })
elseif a == 'rend' then
  State.emit('entity:attack', { target='player', amount=14, source=Ctx.self, action=a })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target='player', typeId='vulnerable', stacks=2 })
elseif a == 'obliterate' then
  State.emit('entity:attack', { target='player', amount=30, source=Ctx.self, action=a })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.emit('status:apply', { target=Ctx.self, typeId='thorns',      stacks=8 })
  State.emit('status:apply', { target=Ctx.self, typeId='metallicize', stacks=5 })
  State.set('battle', 'entities', Ctx.self, 'intent', 'slam')
  return
end
local p   = State.get('battle', 'entities', Ctx.self, 'phase')
local cur = State.get('battle', 'entities', Ctx.self, 'intent') or 'slam'
local next
if p == 'rage' then
  next = 'obliterate'
elseif p == 'mid' then
  next = (cur == 'slam') and 'rend' or 'slam'
else
  next = (cur == 'slam') and 'fortify' or 'slam'
end
State.set('battle', 'entities', Ctx.self, 'intent', next)
`,
    'event:entity:loss': `
if Event.isFatal then return end
local pct = (State.get('battle', 'entities', Ctx.self, 'hp') or 0) / (State.get('battle', 'entities', Ctx.self, 'maxHp') or 1)
if pct < 0.30 and State.get('battle', 'entities', Ctx.self, 'phase') ~= 'rage' then
  State.set('battle', 'entities', Ctx.self, 'phase', 'rage')
elseif pct < 0.60 and State.get('battle', 'entities', Ctx.self, 'phase') == nil then
  State.set('battle', 'entities', Ctx.self, 'phase', 'mid')
end
`,
  },
};

// ── 瘟疫法师 ──────────────────────────────────────────────────────────────────
// 精英怪。HP≥50% 循环施毒/攻击；HP<50% 进入狂热阶段使用 virulence。
export const plague_mage = {
  id: 'plague_mage',
  display: { name: '瘟疫法师' },
  actions: {
    infect:    { type: 'debuff', desc: '施毒：施加 5 层中毒。' },
    plague:    { type: 'attack', desc: '毒击：造成 10 点伤害，施加 5 层中毒。' },
    virulence: { type: 'debuff', desc: '疫潮：施加 7 层中毒和 2 层脆弱。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'infect' then
  State.emit('status:apply', { target='player', typeId='poison', stacks=5 })
elseif a == 'plague' then
  State.emit('entity:attack', { target='player', amount=10, source=Ctx.self, action=a })
  if State.get('battle') == nil then return end
  State.emit('status:apply',  { target='player', typeId='poison', stacks=5 })
elseif a == 'virulence' then
  State.emit('status:apply', { target='player', typeId='poison', stacks=7 })
  if State.get('battle') == nil then return end
  State.emit('status:apply', { target='player', typeId='frail',  stacks=2 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'infect')
  return
end
local p   = State.get('battle', 'entities', Ctx.self, 'phase')
local cur = State.get('battle', 'entities', Ctx.self, 'intent') or 'infect'
local next
if p == 'frenzy' then
  next = (cur == 'virulence') and 'plague' or 'virulence'
else
  next = (cur == 'infect') and 'plague' or 'infect'
end
State.set('battle', 'entities', Ctx.self, 'intent', next)
`,
    'event:entity:loss': `
if Event.isFatal then return end
local pct = (State.get('battle', 'entities', Ctx.self, 'hp') or 0) / (State.get('battle', 'entities', Ctx.self, 'maxHp') or 1)
if pct < 0.50 and State.get('battle', 'entities', Ctx.self, 'phase') ~= 'frenzy' then
  State.set('battle', 'entities', Ctx.self, 'phase', 'frenzy')
end
`,
  },
};
