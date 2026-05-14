/**
 * content/statuses/hooks.js — 事件驱动状态
 *
 * 这些状态由 Power 牌施加，通过监听特定事件产生持久效果。
 */

// ── 洗牌之力 ─────────────────────────────────────────────────────────────────
// 牌库洗牌时获得 2 层力量
export const shuffleStrength = {
  id: 'shuffle_strength',
  display: {
    name: '洗牌之力',
    desc: '牌库洗牌时获得 2 层力量。',
  },
  hooks: {
    'event:deck:deplete': `
      State.emit('status:apply', { target = 'player', typeId = 'strength', stacks = 2 })
    `,
  },
}

// ── 抽牌格挡 ─────────────────────────────────────────────────────────────────
// 每次抽牌时获得 1 点格挡
export const drawBlock = {
  id: 'draw_block',
  display: {
    name: '抽牌格挡',
    desc: '每次抽牌时获得 1 点格挡。',
  },
  hooks: {
    'event:card:draw': `
      State.emit('entity:block', { target = 'player', amount = 1 })
    `,
  },
}

export const ALL_HOOK_STATUS_MODULES = [
  shuffleStrength,
  drawBlock,
]
