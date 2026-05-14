/**
 * rules/index.js — 规则汇总导出
 *
 * 职责：收集所有按子系统拆分的规则，供 module.js 统一导入。
 */

import {
  attackTargetGuardCore, attackCore, damageCore, damageLossCore, lossCore,
  entityDieEmitterCore, healCore, blockCore, entityDieCore,
} from './combat.js'
import {
  cardPlayCore, cardPlayCleanupCore, cardMoveCore, cardSystemMoveCore, cardDrawCore,
  cardDiscardCore, cardExhaustCore, cardCreateCore,
} from './card.js'
import {
  playerTurnStartCore, turnCounterCore, playerTurnEndCore, actorTurnBridgeCore, turnSequenceCore,
} from './turn.js'
import {
  battleStartCore, battleEndCore, flowVictoryCore, defeatEnterCore, flowDefeatCore,
  rewardClaimFlowCore, rewardSkipFlowCore, shopLeaveFlowCore, flowAdvanceCore,
  phaseEnterCore,
} from './flow.js'
import { statusApplyCore, statusRemoveCore } from './status.js'
import { reshuffleCore } from './deck.js'
import { runPlayerSyncCore } from './run.js'
// (debug rules removed — now handled directly by session layer)
import { shopPhaseEnterCore, shopCardsCore, shopRelicCore, shopAssembleCore, shopPriceFinalizeCore, shopLeaveCore, shopBuyCore } from './shop.js'
import { rewardPhaseEnterCore, rewardGoldCore, rewardCardsCore, rewardRelicCore, rewardAssembleCore, rewardClaimCore, rewardSkipCore } from './reward.js'

export {
  attackTargetGuardCore, attackCore, damageCore, damageLossCore, lossCore,
  entityDieEmitterCore, healCore, blockCore, entityDieCore,
  cardPlayCore, cardPlayCleanupCore, cardMoveCore, cardSystemMoveCore, cardDrawCore,
  cardDiscardCore, cardExhaustCore, cardCreateCore,
  playerTurnStartCore, turnCounterCore, playerTurnEndCore, actorTurnBridgeCore, turnSequenceCore,
  battleStartCore, battleEndCore, flowVictoryCore, defeatEnterCore, flowDefeatCore,
  rewardClaimFlowCore, rewardSkipFlowCore, shopLeaveFlowCore, flowAdvanceCore,
  phaseEnterCore,
  statusApplyCore, statusRemoveCore,
  reshuffleCore,
  runPlayerSyncCore,
  shopPhaseEnterCore, shopCardsCore, shopRelicCore, shopAssembleCore, shopPriceFinalizeCore, shopLeaveCore, shopBuyCore,
  rewardPhaseEnterCore, rewardGoldCore, rewardCardsCore, rewardRelicCore, rewardAssembleCore, rewardClaimCore, rewardSkipCore,
}

export const ALL_RULES = [
  attackTargetGuardCore, attackCore, damageCore, damageLossCore, lossCore,
  entityDieEmitterCore, healCore, blockCore, entityDieCore,
  cardPlayCore, cardPlayCleanupCore, cardMoveCore, cardSystemMoveCore, cardDrawCore,
  cardDiscardCore, cardExhaustCore, cardCreateCore,
  playerTurnStartCore, turnCounterCore, playerTurnEndCore, actorTurnBridgeCore, turnSequenceCore,
  battleStartCore, battleEndCore, flowVictoryCore, defeatEnterCore, flowDefeatCore,
  rewardClaimFlowCore, rewardSkipFlowCore, shopLeaveFlowCore, flowAdvanceCore,
  phaseEnterCore,
  statusApplyCore, statusRemoveCore,
  reshuffleCore,
  runPlayerSyncCore,
  shopPhaseEnterCore, shopCardsCore, shopRelicCore, shopAssembleCore, shopPriceFinalizeCore, shopLeaveCore, shopBuyCore,
  rewardPhaseEnterCore, rewardGoldCore, rewardCardsCore, rewardRelicCore, rewardAssembleCore, rewardClaimCore, rewardSkipCore,
]
