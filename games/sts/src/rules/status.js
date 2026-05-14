/**
 * rules/status.js — 状态施加/移除规则
 */

import { BATTLE_ENTITIES_PATH } from '../bindings/config.js'

export const statusApplyCore = {
  id: 'core:status:apply',
  hooks: { 'event:status:apply': `
local stacks = Event.stacks or 0
if stacks == 0 then return end  -- stacks=0 是 no-op，不触发 remove
if not Event.target or not Event.typeId then return end
local cur   = State.get(${BATTLE_ENTITIES_PATH}, Event.target, 'statuses', Event.typeId, 'stacks') or 0
local total = cur + stacks

if total > 0 then
  State.set(${BATTLE_ENTITIES_PATH}, Event.target, 'statuses', Event.typeId, 'stacks', total)
  -- 引擎自动绑定首次施加的状态
else
  State.emit('status:remove', { target = Event.target, typeId = Event.typeId })
end
` },
};

export const statusRemoveCore = {
  id: 'core:status:remove',
  hooks: { 'event:status:remove': `
-- 引擎自动解绑被移除的状态
State.set(${BATTLE_ENTITIES_PATH}, Event.target, 'statuses', Event.typeId, nil)
` },
};
