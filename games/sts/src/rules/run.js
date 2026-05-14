/**
 * rules/run.js — 运行时规则（跨层同步、进度追踪）
 */

import { BATTLE_ENTITIES_PATH } from '../bindings/config.js'

export const runPlayerSyncCore = {
  id: 'core:run:player:sync',
  hooks: { 'event:run:player:sync': `
local battlePlayer = State.get(${BATTLE_ENTITIES_PATH}, 'player')
if not battlePlayer then return end

-- Persist the materialized battle player back into run scope, then strip
-- phase-only fields that should not survive outside battle.
State.set('run', 'player', battlePlayer)
State.set('run', 'player', 'statuses', nil)
State.set('run', 'player', 'energy', nil)
` },
};
