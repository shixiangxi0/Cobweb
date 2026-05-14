/**
 * rules/deck.js — 牌库规则（洗牌）
 */

import {
  BATTLE_DRAW_PILE_PATH,
  BATTLE_DISCARD_PILE_PATH,
} from '../bindings/config.js'

export const reshuffleCore = {
  id: 'core:deck:deplete',
  hooks: { 'event:deck:deplete': `
local src = State.get(${BATTLE_DISCARD_PILE_PATH}) or {}
if #src == 0 then return end
local turn = State.get('battle', 'turn') or 0
local seed = ScenarioSeed + State.hashString('deck_deplete_' .. turn)
local randoms = State.random(seed, #src - 1, 1, #src)
for i = #src, 2, -1 do
  local j = randoms[#src - i + 1]
  src[i], src[j] = src[j], src[i]
end
State.set(${BATTLE_DISCARD_PILE_PATH}, {})
State.set(${BATTLE_DRAW_PILE_PATH}, src)
` },
};
