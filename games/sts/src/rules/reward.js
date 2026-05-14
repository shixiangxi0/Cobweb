/**
 * games/sts/src/rules/reward.js — 奖励流程规则
 *
 * 事件链模式（按 order 降序执行）：
 *   reward:open
 *     order=100  rewardGoldCore      → 生成金币 entry → reward._gold
 *     order=200  rewardCardsCore     → 生成卡牌选项 → reward._cards
 *     order=300  rewardRelicCore     → 生成遗物选项 → reward._relic
 *     order=400  rewardAssembleCore  → 组装 entries，清理临时字段
 *
 * 遗物/效果想干预奖励生成，只需在对应 order 区间插入规则：
 *   - 改金币：order 50~150
 *   - 改卡牌：order 150~250
 *   - 改遗物：order 250~350
 */

export const rewardPhaseEnterCore = {
  id: 'core:reward:phase-enter',
  hooks: { 'event:reward:open': { order: 1000, script: `
    State.emit('phase:enter', { phase = 'reward' })
  ` } },
};

export const rewardGoldCore = {
  id: 'core:reward:gold',
  hooks: { 'event:reward:open': { order: 400, script: `
    local goldReward = Event.goldReward or 0
    if goldReward > 0 then
      State.set('reward', '_gold', { key = 'gold', kind = 'gold', amount = goldReward })
    end
  ` } },
};

export const rewardCardsCore = {
  id: 'core:reward:cards',
  hooks: { 'event:reward:open': { order: 300, script: `
    local floor = State.get('run', 'progress', 'floorIndex') or 0
    local shuffled = State.shuffle(ScenarioSeed + State.hashString('reward_cards_' .. floor), Pools.cards)
    local cards = {}
    for i = 1, math.min(3, #shuffled) do
      table.insert(cards, shuffled[i])
    end
    State.set('reward', '_cards', cards)
  ` } },
};

export const rewardRelicCore = {
  id: 'core:reward:relic',
  hooks: { 'event:reward:open': { order: 200, script: `
    local ownedRelics = State.get('run', 'relics') or {}
    local ownedSet = {}
    for _, id in ipairs(ownedRelics) do ownedSet[id] = true end

    local pool = {}
    for _, relic in ipairs(Pools.relics) do
      if not ownedSet[relic.id] then table.insert(pool, relic) end
    end

    if #pool > 0 then
      local floor = State.get('run', 'progress', 'floorIndex') or 0
      local shuffled = State.shuffle(ScenarioSeed + State.hashString('reward_relic_' .. floor), pool)
      State.set('reward', '_relic', shuffled[1])
    end
  ` } },
};

export const rewardAssembleCore = {
  id: 'core:reward:assemble',
  hooks: { 'event:reward:open': { order: 100, script: `
    local entries = {}

    local gold = State.get('reward', '_gold')
    if gold then table.insert(entries, gold) end

    local cards = State.get('reward', '_cards') or {}
    for _, card in ipairs(cards) do
      table.insert(entries, { key = 'card:' .. card.id, kind = 'card', cardId = card.id })
    end

    local relic = State.get('reward', '_relic')
    if relic then
      table.insert(entries, { key = 'relic:' .. relic.id, kind = 'relic', relicId = relic.id })
    end

    State.set('reward', 'entries', entries)
    State.set('reward', 'claimed', nil)
    State.set('reward', 'skipped', false)
    State.set('reward', 'afterReward', Event.afterReward)

    -- 清理临时字段
    State.set('reward', '_gold', nil)
    State.set('reward', '_cards', nil)
    State.set('reward', '_relic', nil)
  ` } },
};

export const rewardClaimCore = {
  id: 'core:reward:claim',
  hooks: { 'event:reward:claim': `
    local reward = State.get('reward')
    if not reward then
      Event.cancelled = true
      Event.reason = 'no_reward'
      return
    end

    local selected = nil
    for _, entry in ipairs(reward.entries or {}) do
      if entry.key == Event.key then
        selected = entry
        break
      end
    end

    if not selected then
      Event.cancelled = true
      Event.reason = 'invalid_choice'
      return
    end

    if selected.kind ~= 'gold' and selected.kind ~= 'card' and selected.kind ~= 'relic' then
      Event.cancelled = true
      Event.reason = 'invalid_choice'
      return
    end

    State.set('reward', 'claimed', selected)
    State.set('reward', 'entries', {})
  ` },
};

export const rewardSkipCore = {
  id: 'core:reward:skip',
  hooks: { 'event:reward:skip': `
    if not State.get('reward') then
      Event.cancelled = true
      Event.reason = 'no_reward'
      return
    end

    State.set('reward', 'skipped', true)
    State.set('reward', 'entries', {})
  ` },
};
