# STS 参考实现

一个精简但完整的 STS 战斗系统，使用 Cobweb 的 **bind + defs + match** 机制。只展示核心内容，不暴露全部复杂度。

## 项目结构

```
sts/
├── rules/
│   ├── card.js      # 卡牌全局规则（费用检查、区域流转）
│   ├── combat.js    # 战斗规则（damage 链）
│   └── turn.js      # 回合规则
├── content/
│   ├── cards.js     # 卡牌定义（strike, defend）
│   ├── enemies.js   # 敌人定义（jaw_worm）
│   └── statuses.js  # 状态定义（strength, weak）
├── module.js        # 组装 Module
└── index.js         # 入口：创建 Engine、bind、运行
```

---

## 核心机制：bind + match

**卡牌/状态/敌人的效果不是写死在全局规则里的。** 每张卡、每个状态、每个敌人都是**独立的定义对象**，通过 `State.bind()` 动态挂载到状态树。

```js
// 抽牌时绑定卡牌实例
engine.state.bind({
  key: 'c1',           // 绑定键
  kind: 'card',        // 定义类型
  id: 'strike',        // 对应 defs.card.strike
  ctx: { iid: 'c1' }   // 上下文：instanceId
});
```

绑定后，`defs.card.strike` 里的 hooks 会被注册到事件管道。引擎通过 `defaultMatchByKind` 自动推断 match 规则：

```js
// module.js 中声明
defaultMatchByKind: {
  card:   { instanceId: 'iid' },   // 卡牌 hook 只匹配 ctx.iid 对应的实例
  status: { target: 'self' },      // 状态 hook 只匹配 Ctx.self 对应的实体
  enemy:  { target: 'self' },      // 敌人 hook 只匹配 Ctx.self 对应的实体
}
```

---

## 规则文件

### rules/card.js — 卡牌全局规则

```javascript
/**
 * rules/card.js — 卡牌全局规则
 *
 * 所有卡牌共用：费用检查、区域流转。
 * 卡牌效果由各自定义对象的 hooks 处理，不在这里写 if/else。
 */

export const cardPlayCore = {
  id: 'core:card:play',
  hooks: {
    'event:card:play': {
      order: 100,
      script: `
local cost = State.get('cards', Event.instanceId, 'cost') or 0
local energy = State.get('entities', 'player', 'energy') or 0
if energy < cost then
  Event.cancelled = true
  return
end
State.set('entities', 'player', 'energy', energy - cost)
State.emit('card:effect', {
  instanceId = Event.instanceId,
  cardId     = Event.cardId,
  target     = Event.target,
})
`
    }
  }
};

export const cardPlayCleanup = {
  id: 'core:card:play:cleanup',
  hooks: {
    'event:card:play': {
      order: -400,
      script: `
if Event.cancelled then return end
local iid = Event.instanceId
local cardId = State.get('cards', iid, 'cardId')
State.emit('card:system:move', {
  from       = 'hand',
  to         = 'discardPile',
  instanceId = iid,
  cardId     = cardId,
})
`
    }
  }
};

const RELOCATE_SCRIPT = `
local iid = Event.instanceId
if not iid then return end

local function getZone(zone)
  if zone == 'drawPile'    then return State.get('battle', 'drawPile') or {} end
  if zone == 'hand'        then return State.get('battle', 'hand') or {} end
  if zone == 'discardPile' then return State.get('battle', 'discardPile') or {} end
  return State.get(zone) or {}
end

local function setZone(zone, value)
  if zone == 'drawPile'    then State.set('battle', 'drawPile', value); return end
  if zone == 'hand'        then State.set('battle', 'hand', value); return end
  if zone == 'discardPile' then State.set('battle', 'discardPile', value); return end
  State.set(zone, value)
end

if Event.from then
  local src = getZone(Event.from)
  local newSrc = {}
  for _, c in ipairs(src) do if c ~= iid then table.insert(newSrc, c) end end
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
  hooks: {
    'event:card:move':       { order: 1000, script: RELOCATE_SCRIPT },
    'event:card:system:move':{ order: 1000, script: RELOCATE_SCRIPT }
  }
};

export const cardDrawCore = {
  id: 'core:card:draw',
  hooks: {
    'event:card:draw': `
local drawPile = State.get('battle', 'drawPile') or {}
if #drawPile == 0 then
  State.emit('deck:deplete', {})
  drawPile = State.get('battle', 'drawPile') or {}
  if #drawPile == 0 then return end
end
local iid = drawPile[1]
local cardId = State.get('battle', 'cards', iid, 'cardId')
State.emit('card:move', {
  from       = 'drawPile',
  to         = 'hand',
  instanceId = iid,
  cardId     = cardId,
})
`
  }
};
```

### rules/combat.js — 战斗规则

```javascript
/**
 * rules/combat.js — 战斗实体规则
 *
 * 事件链：entity:attack → entity:damage → entity:loss → entity:die
 */

export const attackCore = {
  id: 'core:entity:attack',
  hooks: {
    'event:entity:attack': `
State.emit('entity:damage', {
  target = Event.target,
  amount = Event.amount,
  source = Event.source,
  action = Event.action,
})
`
  }
};

export const damageCore = {
  id: 'core:entity:damage',
  hooks: {
    'event:entity:damage': `
local block = State.get('battle', 'entities', Event.target, 'statuses', 'block', 'stacks') or 0
local blocked = math.min(block, Event.amount)
local net = Event.amount - blocked

if blocked > 0 then
  State.emit('status:apply', { target = Event.target, typeId = 'block', stacks = -blocked })
end

Event.actualDamage = net
Event.blocked = blocked
`
  }
};

export const damageLoss = {
  id: 'core:entity:damage:loss',
  hooks: {
    'event:entity:damage': {
      order: -9999,
      script: `
local net = Event.actualDamage or 0
if net > 0 then
  State.emit('entity:loss', {
    target = Event.target,
    amount = net,
    source = Event.source,
    action = Event.action,
  })
end
`
    }
  }
};

export const lossCore = {
  id: 'core:entity:loss',
  hooks: {
    'event:entity:loss': `
local hp = State.get('battle', 'entities', Event.target, 'hp') or 0
local loss = math.min(Event.amount, hp)
State.set('battle', 'entities', Event.target, 'hp', hp - loss)
Event.actualLoss = loss
Event.isFatal = loss > 0 and (hp - loss) <= 0
`
  }
};

export const dieEmitter = {
  id: 'core:entity:die:emitter',
  hooks: {
    'event:entity:loss': {
      order: -9999,
      script: `
if Event.isFatal then
  State.emit('entity:die', { target = Event.target })
end
`
    }
  }
};
```

### rules/turn.js — 回合规则

```javascript
/**
 * rules/turn.js — 回合生命周期规则
 */

export const playerTurnStartCore = {
  id: 'core:player:turn:start',
  hooks: {
    'event:player:turn:start': `
local n = State.get('battle', 'entities', 'player', 'drawPerTurn') or 5
for i = 1, n do
  State.emit('card:draw', {})
end
`
  }
};

export const playerTurnStartEnergy = {
  id: 'core:player:turn:start:energy',
  hooks: {
    'event:player:turn:start': `
local maxEnergy = State.get('battle', 'entities', 'player', 'maxEnergy') or 3
State.set('battle', 'entities', 'player', 'energy', maxEnergy)
`
  }
};

export const turnSequenceCore = {
  id: 'core:turn:sequence',
  hooks: {
    'event:turn:end': `
-- 玩家回合结束：手牌进弃牌堆
for _, iid in ipairs(State.get('battle', 'hand') or {}) do
  State.emit('card:system:move', {
    from       = 'hand',
    to         = 'discardPile',
    instanceId = iid,
    cardId     = State.get('battle', 'cards', iid, 'cardId'),
  })
end

-- 敌人行动
for slot = 1, 10 do
  local eid = State.get('battle', 'enemies', tostring(slot))
  if eid ~= nil then
    local intent = State.get('battle', 'entities', eid, 'intent')
    if intent then
      State.emit('enemy:action', { target = eid, action = intent })
    end
  end
end

-- 进入下一回合
State.set('battle', 'turn', (State.get('battle', 'turn') or 0) + 1)
State.emit('player:turn:start', {})
`
  }
};
```

---

## 内容定义

### content/cards.js — 卡牌定义

**卡牌效果写在各自的 hooks 里，不耦合到全局规则。**

```javascript
export const strike = {
  id: 'strike',
  cost: 1,
  targetType: 'enemy',
  display: { name: '打击', type: 'attack', desc: '造成 6 点伤害。' },
  hooks: {
    'event:card:effect': `
State.emit('entity:attack', {
  target = Event.target,
  amount = 6,
  source = 'player',
})
`
  }
};

export const defend = {
  id: 'defend',
  cost: 1,
  targetType: 'none',
  display: { name: '防御', type: 'skill', desc: '获得 5 点格挡。' },
  hooks: {
    'event:card:effect': `
State.emit('status:apply', { target = 'player', typeId = 'block', stacks = 5 })
`
  }
};
```

### content/statuses.js — 状态定义

**状态使用 `match: { source: 'self' }` 只影响绑定它的实体。**

```javascript
export const strength = {
  id: 'strength',
  display: { name: '力量', desc: '攻击造成等同层数的额外伤害。' },
  hooks: {
    'event:entity:attack': {
      order: 200,
      match: { source: 'self' },   // 只匹配 source == Ctx.self 的攻击
      script: `
Event.amount = Event.amount + (State.get('battle', 'entities', Ctx.self, 'statuses', 'strength', 'stacks') or 0)
`
    }
  }
};

export const weak = {
  id: 'weak',
  display: { name: '虚弱', desc: '造成的伤害降低 25%。' },
  hooks: {
    'event:entity:attack': {
      order: 150,
      match: { source: 'self' },
      script: `Event.amount = math.floor(Event.amount * 0.75)`
    },
    'event:actor:turn:end': {
      order: 500,
      match: { target: 'self' },
      script: `
State.emit('status:apply', { target = Ctx.self, typeId = 'weak', stacks = -1 })
`
    }
  }
};
```

### content/enemies.js — 敌人定义

**敌人也是定义对象，通过 bind 挂载。生命周期钩子自动绑定。**

```javascript
export const jawWorm = {
  id: 'jaw_worm',
  display: { name: '颚虫' },
  actions: {
    bite:   { type: 'attack', desc: '造成 11 点伤害。' },
    thrash: { type: 'attack', desc: '造成 7 点伤害。施加 3 层力量。' },
  },
  hooks: {
    'event:enemy:action': `
local a = Event.action
if a == 'bite' then
  State.emit('entity:attack', { target='player', amount=11, source=Ctx.self, action=a })
elseif a == 'thrash' then
  State.emit('entity:attack', { target='player', amount=7, source=Ctx.self, action=a })
  State.emit('status:apply', { target=Ctx.self, typeId='strength', stacks=3 })
end
`,
    'event:enemy:update': `
if Event.cause == 'init' then
  State.set('battle', 'entities', Ctx.self, 'intent', 'bite')
  return
end
local cur = State.get('battle', 'entities', Ctx.self, 'intent') or 'bite'
State.set('battle', 'entities', Ctx.self, 'intent', cur == 'bite' and 'thrash' or 'bite')
`
  }
};
```

---

## Module 组装

```javascript
import * as cardRules   from './rules/card.js';
import * as combatRules from './rules/combat.js';
import * as turnRules   from './rules/turn.js';
import * as cards       from './content/cards.js';
import * as enemies     from './content/enemies.js';
import * as statuses    from './content/statuses.js';

function byId(arr) {
  return Object.fromEntries(arr.map(d => [d.id, d]));
}

export const stsModule = {
  events: {
    'card:play':         {},
    'card:effect':       {},
    'card:draw':         {},
    'card:move':         {},
    'card:system:move':  {},
    'card:discard':      {},
    'entity:attack':     {},
    'entity:damage':     {},
    'entity:loss':       {},
    'entity:die':        {},
    'enemy:action':      {},
    'enemy:update':      {},
    'status:apply':      {},
    'status:remove':     {},
    'player:turn:start': {},
    'turn:end':          {},
    'deck:deplete':      {},
  },

  // 上下文继承：card:effect 自动继承 card:play 的 instanceId / cardId
  contextInheritance: {
    'card:effect': ['instanceId', 'cardId', 'target'],
  },

  // 默认 match 规则：按 kind 自动推断
  defaultMatchByKind: {
    card:   { instanceId: 'iid' },
    status: { target: 'self' },
    enemy:  { target: 'self' },
  },

  // 静态规则（全局机制）
  rules: [
    cardRules.cardPlayCore,
    cardRules.cardPlayCleanup,
    cardRules.cardMoveCore,
    cardRules.cardDrawCore,
    combatRules.attackCore,
    combatRules.damageCore,
    combatRules.damageLoss,
    combatRules.lossCore,
    combatRules.dieEmitter,
    turnRules.playerTurnStartCore,
    turnRules.playerTurnStartEnergy,
    turnRules.turnSequenceCore,
  ],

  // 定义数据（供 State.bind 查找）
  defs: {
    card:   byId(Object.values(cards)),
    enemy:  byId(Object.values(enemies)),
    status: byId(Object.values(statuses)),
  }
};
```

---

## 运行

```javascript
import { createEngine } from 'cobweb';
import { stsModule } from './module.js';

async function main() {
  const engine = await createEngine();
  engine.use(stsModule);

  // 加载战斗状态
  engine.load({
    turn: 1,
    entities: {
      player: { hp: 80, maxHp: 80, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
      'jaw_worm_1': { hp: 40, maxHp: 40, intent: 'bite' }
    },
    cards: {
      'strike_1': { cardId: 'strike', cost: 1 },
      'defend_1': { cardId: 'defend', cost: 1 },
    },
    hand: ['strike_1', 'defend_1'],
    discardPile: [],
    drawPile: [],
    enemies: { '1': 'jaw_worm_1' }
  });

  // 绑定卡牌实例（实际由抽牌流程自动完成）
  engine.state.bind({ key: 'strike_1', kind: 'card', id: 'strike', ctx: { iid: 'strike_1' } });
  engine.state.bind({ key: 'defend_1', kind: 'card', id: 'defend', ctx: { iid: 'defend_1' } });

  // 绑定敌人实例（实际由 battle:start 生命周期自动完成）
  engine.state.bind({ key: 'jaw_worm_1', kind: 'enemy', id: 'jaw_worm', ctx: { self: 'jaw_worm_1' } });

  // 玩家打出打击
  engine.state.emit('card:play', { instanceId: 'strike_1', cardId: 'strike', target: 'jaw_worm_1' });
  console.log('敌人 HP:', engine.getState().battle.entities['jaw_worm_1'].hp);  // 34

  engine.close();
}

main().catch(console.error);
```

---

## 关键设计

| 机制 | 说明 |
|------|------|
| **bind** | 动态挂载定义对象的 hooks，实现卡牌/状态/敌人的解耦 |
| **match** | `defaultMatchByKind` 自动推断，只触发属于当前实例的 hook |
| **contextInheritance** | `card:effect` 自动继承 `card:play` 的 instanceId/cardId，无需手动传递 |
| **order** | 控制同事件多规则的执行顺序：`damageCore(0)` → `damageLoss(-9999)` |
| **三段伤害** | `attack → damage → loss`，中间可插入 Buff/Debuff 干预 |
