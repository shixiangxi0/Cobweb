/**
 * games/sts/src/rules/shop.js — 商店规则
 *
 * 事件链模式（按 order 降序执行）：
 *   shop:enter
 *     order=100  shopCardsCore      → 生成卡牌库存 → shop._cards
 *     order=200  shopRelicCore      → 生成遗物库存 → shop._relic
 *     order=300  shopAssembleCore   → 组装 shop 状态（stock + gold + purchases + pricing + benefits）
 *     order=-100 shopPriceFinalizeCore → 重算所有展示字段（price / canAfford / freeEligible）
 *
 *   shop:stock:updated
 *     order=-100 shopPriceFinalizeCore → 同上（购买后 stock 变动时重算）
 *
 *   shop:buy
 *     order=0    shopBuyCore        → 扣金币、记录 purchases、移除 stock、emit shop:stock:updated
 *
 *   shop:leave
 *     order=0    shopLeaveCore      → purchases 提交到 run，清除 shop 状态
 */

// ── 共享 Lua 脚本：重算 stock 展示字段 ──────────────────────────────────────

const PRICE_FINALIZE_SCRIPT = `
local shop = State.get('shop')
if not shop then return end

local gold = shop.gold or 0
local discountMultiplier = shop.pricing and shop.pricing.discountMultiplier or 1
local freePurchase = shop.benefits and shop.benefits.freePurchase
local freeRemaining = freePurchase and (freePurchase.remainingUses or 0) or 0
local freeMaxBasePrice = freePurchase and (freePurchase.maxBasePrice or -1) or -1

local stock = shop.stock or {}
for i, item in ipairs(stock) do
  local basePrice = item.basePrice or 0
  local discountedPrice = math.max(0, math.floor(basePrice * discountMultiplier))
  local freeEligible = freeRemaining > 0 and basePrice <= freeMaxBasePrice
  local price = freeEligible and 0 or discountedPrice

  stock[i] = {
    type = item.type,
    id = item.id,
    basePrice = basePrice,
    discountedPrice = discountedPrice,
    price = price,
    canAfford = freeEligible or gold >= price,
    freeEligible = freeEligible,
  }
end

State.set('shop', 'stock', stock)
`;

// ── 规则定义 ───────────────────────────────────────────────────────────────

export const shopPhaseEnterCore = {
  id: 'core:shop:phase-enter',
  hooks: { 'event:shop:enter': { order: 1000, script: `
    State.emit('phase:enter', { phase = 'shop' })
  ` } },
};

export const shopCardsCore = {
  id: 'core:shop:cards',
  hooks: { 'event:shop:enter': { order: 300, script: `
    local floor = State.get('run', 'progress', 'floorIndex') or 0
    local shuffled = State.shuffle(ScenarioSeed + State.hashString('shop_cards_' .. floor), Pools.cards)
    local cards = {}
    for i = 1, math.min(3, #shuffled) do
      table.insert(cards, shuffled[i])
    end
    State.set('shop', '_cards', cards)
  ` } },
};

export const shopRelicCore = {
  id: 'core:shop:relic',
  hooks: { 'event:shop:enter': { order: 200, script: `
    local ownedRelics = State.get('run', 'relics') or {}
    local ownedSet = {}
    for _, id in ipairs(ownedRelics) do ownedSet[id] = true end

    local pool = {}
    for _, relic in ipairs(Pools.relics) do
      if not ownedSet[relic.id] then table.insert(pool, relic) end
    end

    if #pool > 0 then
      local floor = State.get('run', 'progress', 'floorIndex') or 0
      local shuffled = State.shuffle(ScenarioSeed + State.hashString('shop_relic_' .. floor), pool)
      State.set('shop', '_relic', shuffled[1])
    end
  ` } },
};

export const shopAssembleCore = {
  id: 'core:shop:assemble',
  hooks: { 'event:shop:enter': { order: 100, script: `
    local stock = {}

    local cards = State.get('shop', '_cards') or {}
    for _, card in ipairs(cards) do
      local basePrice = 45
      if card.rarity == 'uncommon' then basePrice = 75
      elseif card.rarity == 'rare' then basePrice = 150 end
      table.insert(stock, { type = 'card', id = card.id, basePrice = basePrice })
    end

    local relic = State.get('shop', '_relic')
    if relic then
      table.insert(stock, { type = 'relic', id = relic.id, basePrice = relic.shopPrice or 150 })
    end

    State.set('shop', {
      stock = stock,
      gold = State.get('run', 'gold') or 0,
      purchases = {
        cards = {},
        relics = {},
        spentGold = 0,
      },
      pricing = {
        discountMultiplier = 1,
      },
      afterShop = Event.afterShop,
      benefits = {},
    })

    -- 清理临时字段
    State.set('shop', '_cards', nil)
    State.set('shop', '_relic', nil)
  ` } },
};

export const shopPriceFinalizeCore = {
  id: 'core:shop:price-finalize',
  hooks: {
    'event:shop:enter': { order: -100, script: PRICE_FINALIZE_SCRIPT },
    'event:shop:stock:updated': { order: -100, script: PRICE_FINALIZE_SCRIPT },
  },
};

export const shopLeaveCore = {
  id: 'core:shop:leave',
  hooks: { 'event:shop:leave': `
    local shop = State.get('shop')
    if shop and shop.afterShop then
      Event.afterShop = shop.afterShop
    end
    if shop then
      State.set('run', 'gold', shop.gold or State.get('run', 'gold') or 0)

      local purchases = shop.purchases or {}
      if purchases.cards and #purchases.cards > 0 then
        local deck = State.get('run', 'deck') or {}
        local nextDeck = {}
        for _, entry in ipairs(deck) do table.insert(nextDeck, entry) end
        for _, cardId in ipairs(purchases.cards) do
          table.insert(nextDeck, { cardId = cardId, upgrades = 0 })
        end
        State.set('run', 'deck', nextDeck)
      end

      if purchases.relics and #purchases.relics > 0 then
        for _, relicId in ipairs(purchases.relics) do
          State.emit('relic:acquire', { relicId = relicId })
        end
      end
    end
    State.set('shop', nil)
  ` },
};

export const shopBuyCore = {
  id: 'core:shop:buy',
  hooks: { 'event:shop:buy': `
    local stock = State.get('shop', 'stock') or {}
    local item = stock[Event.index]
    if not item then
      Event.cancelled = true
      Event.reason = 'not_found'
      return
    end

    Event.originalPrice = item.basePrice or 0
    Event.discountedPrice = item.discountedPrice or item.price or 0
    Event.price = item.price or 0
    Event.freeEligible = item.freeEligible or false

    local gold = State.get('shop', 'gold') or 0
    if gold < (item.price or 0) then
      Event.cancelled = true
      Event.reason = 'insufficient_gold'
      return
    end

    if item.type == 'relic' then
      for _, relicId in ipairs(State.get('run', 'relics') or {}) do
        if relicId == item.id then
          Event.cancelled = true
          Event.reason = 'already_owned'
          return
        end
      end
      for _, relicId in ipairs(State.get('shop', 'purchases', 'relics') or {}) do
        if relicId == item.id then
          Event.cancelled = true
          Event.reason = 'already_owned'
          return
        end
      end
    elseif item.type ~= 'card' then
      Event.cancelled = true
      Event.reason = 'invalid_item'
      return
    end

    State.set('shop', 'gold', gold - (item.price or 0))
    State.set(
      'shop',
      'purchases',
      'spentGold',
      (State.get('shop', 'purchases', 'spentGold') or 0) + (item.price or 0)
    )

    if item.freeEligible then
      local freePurchase = State.get('shop', 'benefits', 'freePurchase')
      if freePurchase then
        local remainingUses = math.max(0, (freePurchase.remainingUses or 0) - 1)
        State.set('shop', 'benefits', 'freePurchase', 'remainingUses', remainingUses)
      end
    end

    if item.type == 'card' then
      local cards = State.get('shop', 'purchases', 'cards') or {}
      local nextCards = {}
      for _, cardId in ipairs(cards) do table.insert(nextCards, cardId) end
      table.insert(nextCards, item.id)
      State.set('shop', 'purchases', 'cards', nextCards)
    elseif item.type == 'relic' then
      local relics = State.get('shop', 'purchases', 'relics') or {}
      local nextRelics = {}
      for _, relicId in ipairs(relics) do table.insert(nextRelics, relicId) end
      table.insert(nextRelics, item.id)
      State.set('shop', 'purchases', 'relics', nextRelics)
    end

    -- 移除已购 item，触发 price-finalize 重算剩余 stock
    local nextStock = {}
    for i, stockItem in ipairs(stock) do
      if i ~= Event.index then
        table.insert(nextStock, stockItem)
      end
    end
    State.set('shop', 'stock', nextStock)
    State.emit('shop:stock:updated', {})
  ` },
};
