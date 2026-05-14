/**
 * bindings/config.js — 绑定配置与状态树路径常量
 *
 * 职责：
 *   - 状态树路径常量（供 Lua 脚本引用）
 *   - 上下文继承配置
 *   - 默认匹配规则
 *   - 绑定所需上下文字段
 */

// ── 状态树路径常量 ───────────────────────────────────────────────────────────

const BATTLE_PATH = `'battle'`
export const BATTLE_ENEMIES_PATH = `${BATTLE_PATH}, 'enemies'`
export const BATTLE_ENTITIES_PATH = `${BATTLE_PATH}, 'entities'`
export const BATTLE_CARDS_PATH = `${BATTLE_PATH}, 'cards'`
export const BATTLE_DRAW_PILE_PATH = `${BATTLE_PATH}, 'drawPile'`
export const BATTLE_HAND_PATH = `${BATTLE_PATH}, 'hand'`
export const BATTLE_DISCARD_PILE_PATH = `${BATTLE_PATH}, 'discardPile'`
export const BATTLE_EXHAUST_PILE_PATH = `${BATTLE_PATH}, 'exhaustPile'`
export const BATTLE_TURN_PATH = `${BATTLE_PATH}, 'turn'`

// ── 上下文继承配置 ───────────────────────────────────────────────────────────

export const CONTEXT_INHERITANCE = {
  'entity:attack':  ['instanceId', 'cardId', 'action', 'meta'],
  'entity:damage':  ['instanceId', 'cardId', 'action', 'meta'],
  'entity:loss':    ['instanceId', 'cardId', 'action', 'meta'],
  'entity:heal':    ['instanceId', 'cardId', 'action', 'meta'],
  'entity:block':   ['instanceId', 'cardId', 'action', 'meta'],
  'status:apply':   ['instanceId', 'cardId', 'action', 'meta'],
  'status:remove':  ['instanceId', 'cardId', 'action', 'meta'],
}

export const CONTEXT_INHERITANCE_MAP = {
  instanceId: { ctxKey: 'iid' },
}

export const DEFAULT_MATCH_BY_KIND = {
  card:   { instanceId: 'iid' },
  status: { target: 'self' },
  enemy:  { target: 'self' },
}

export const REQUIRED_CTX = {
  card:       ['iid'],
  enemy:      ['self'],
  status:     ['self'],
}
