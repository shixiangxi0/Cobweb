/**
 * games/sts/src/content/relics.js — 遗物定义
 *
 * 遗物通过 hooks 被动影响游戏，和卡牌/状态的机制完全一致。
 */

export const merchantBadge = {
  id: 'merchant_badge',
  shopPrice: 150,
  display: {
    name: '商人徽章',
    desc: '商店价格打九折，且第一件原价不大于50金币的商品免费。',
  },
  hooks: {
    'event:shop:enter': `
      local discountMultiplier = State.get('shop', 'pricing', 'discountMultiplier') or 1
      State.set('shop', 'pricing', 'discountMultiplier', discountMultiplier * 0.9)

      local freePurchase = State.get('shop', 'benefits', 'freePurchase') or {
        remainingUses = 0,
        maxBasePrice = 0,
      }
      State.set('shop', 'benefits', 'freePurchase', {
        remainingUses = (freePurchase.remainingUses or 0) + 1,
        maxBasePrice = math.max(freePurchase.maxBasePrice or 0, 50),
      })
    `,
  },
};

// ── 无尽墨水瓶 ───────────────────────────────────────────────────────────────
export const endlessInkwell = {
  id: 'endless_inkwell',
  shopPrice: 200,
  display: {
    name: '无尽墨水瓶',
    desc: '每次牌库洗牌时，将一张随机已消耗牌复制回抽牌堆。战斗开始时获得 1 点能量。',
  },
  hooks: {
    'event:deck:deplete': `
      local exhaustPile = State.get('battle', 'exhaustPile') or {}
      if #exhaustPile > 0 then
        local turn = State.get('battle', 'turn') or 0
        local idx = State.random(ScenarioSeed + State.hashString('exhaust_recall_' .. turn), 1, 1, #exhaustPile)[1]
        local iid = exhaustPile[idx]
        local cardId = State.get('battle', 'cards', iid, 'cardId')
        if cardId then
          State.emit('card:create', { cardId = cardId, destination = 'drawPile' })
        end
      end
    `,
    'event:battle:start': `
      local energy = State.get('battle', 'entities', 'player', 'energy') or 0
      State.set('battle', 'entities', 'player', 'energy', energy + 1)
    `,
  },
};

// ── 痛苦放大器 ───────────────────────────────────────────────────────────────
export const painAmplifier = {
  id: 'pain_amplifier',
  shopPrice: 180,
  display: {
    name: '痛苦放大器',
    desc: '每次受到实际伤害时，获得 1 层力量。',
  },
  hooks: {
    'event:entity:loss': {
      order: -100,
      script: `
        local loss = Event.actualLoss or 0
        if loss > 0 then
          State.emit('status:apply', { target = Ctx.self, typeId = 'strength', stacks = 1 })
        end
      `,
    },
  },
};

// ── 棱镜咒印 ─────────────────────────────────────────────────────────────────
export const prismSigil = {
  id: 'prism_sigil',
  shopPrice: 200,
  display: {
    name: '棱镜咒印',
    desc: '战斗开始时获得 5 层咒印。咒印上限 +3。',
  },
  hooks: {
    'event:battle:start': `
      State.set('battle', 'sigil_stack', 5)
      State.set('battle', 'sigil_cap', (State.get('battle', 'sigil_cap') or 12) + 3)
    `,
  },
};

// ── 织者之线 ─────────────────────────────────────────────────────────────────
export const weaversThread = {
  id: 'weavers_thread',
  shopPrice: 250,
  display: {
    name: '织者之线',
    desc: '每连续打出 3 张同类型咒印牌，第 4 张自动对所有敌人造成 5 点伤害。',
  },
  hooks: {
    'event:card:effect': {
      order: -500,
      script: `
        local cardId = Event.cardId
        local cardDef = Defs.card and Defs.card[cardId]
        local sigilType = cardDef and cardDef.sigilType
        if not sigilType then return end

        local weaverType = State.get('battle', 'weaver_type')
        local weaverCount = State.get('battle', 'weaver_count') or 0

        if weaverType == sigilType then
          weaverCount = weaverCount + 1
          if weaverCount >= 4 then
            for slot = 1, 10 do
              local eid = State.get('battle', 'enemies', tostring(slot))
              if eid ~= nil and (State.get('battle', 'entities', eid, 'hp') or 0) > 0 then
                State.emit('entity:attack', { target = eid, amount = 5, source = 'player' })
              end
            end
            weaverCount = 0
          end
        else
          weaverType = sigilType
          weaverCount = 1
        end

        State.set('battle', 'weaver_type', weaverType)
        State.set('battle', 'weaver_count', weaverCount)
      `,
    },
  },
};
