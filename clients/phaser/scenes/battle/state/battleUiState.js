import {
  CARD_STATES,
  isZoneTransitionCardState,
} from './battleCardState.js';
import { resolveEnemyActorTargetState } from './battleActorState.js';
import { BATTLE_MODES } from './battleModeState.js';
import { setActorNodeTargetState } from '../view/battleViews.js';
import { CARD_UI, COLORS } from '../../../src/constants.js';

export function modeLabel(mode) {
  if (mode === BATTLE_MODES.loading) return '布势';
  if (mode === BATTLE_MODES.idle) return '落子';
  if (mode === BATTLE_MODES.targeting) return '取势';
  if (mode === BATTLE_MODES.animating) return '应手';
  if (mode === BATTLE_MODES.flow) return '结算';
  if (mode === BATTLE_MODES.paused) return '暂停';
  if (mode === BATTLE_MODES.battleOver) return '终局';
  return mode;
}

export function applyModeToHud(ui, mode) {
  if (!ui?.modeText) return;
  ui.modeText.setText(mode === BATTLE_MODES.idle ? '' : modeLabel(mode));
  ui.modeText.setColor(
    mode === BATTLE_MODES.targeting ? COLORS.accentGold
      : mode === BATTLE_MODES.animating ? COLORS.accentTeal
        : mode === BATTLE_MODES.flow ? COLORS.accentGold
        : mode === BATTLE_MODES.paused ? COLORS.accentCoral
        : COLORS.textDim,
  );
}

export function refreshCardVisualState({
  handNodes,
  targetingCardId,
  energy,
  mode,
  isPlayable,
}) {
  for (const node of handNodes.values()) {
    // 初始化脏检查缓存
    if (!node._visualCache) {
      node._visualCache = {};
    }
    const cache = node._visualCache;

    if (node.uiState === CARD_STATES.resolving) {
      if (cache.state !== 'resolving') {
        node.outer.setStrokeStyle(2, COLORS.frameSoft, 0);
        node.container.setAlpha(1);
        node.glow.setAlpha(0.1);
        cache.state = 'resolving';
      }
      continue;
    }

    if (isZoneTransitionCardState(node.uiState)) {
      cache.state = 'zone';
      continue;
    }

    const selected = targetingCardId === node.card.instanceId;
    const playable = isPlayable(node.card, energy);

    if (selected) {
      if (cache.state !== 'selected') {
        node.outer.setStrokeStyle(3, COLORS.targetGlow, 0.92);
        node.glow.setAlpha(0.12);
        cache.state = 'selected';
      }
      continue;
    }

    if (!playable) {
      if (cache.state !== 'disabled') {
        node.outer.setStrokeStyle(2, COLORS.cardMuted, 0.44);
        node.container.setAlpha(CARD_UI.motion.disabledAlpha);
        node.glow.setAlpha(0);
        cache.state = 'disabled';
      }
      continue;
    }

    if (node.uiState === CARD_STATES.hover && mode === BATTLE_MODES.idle) {
      if (cache.state !== 'hover') {
        node.outer.setStrokeStyle(2, COLORS.frameSoft, 0.26);
        node.container.setAlpha(1);
        node.glow.setAlpha(0.1);
        cache.state = 'hover';
      }
      continue;
    }

    if (cache.state !== 'idle') {
      node.outer.setStrokeStyle(2, COLORS.frameSoft, 0);
      node.container.setAlpha(1);
      node.glow.setAlpha(0);
      cache.state = 'idle';
    }
  }
}

export function refreshEnemyTargetState({
  scene,
  enemyNodes,
  mode,
  drag,
}) {
  const hoveredEnemyId = drag?.hoverEnemyId ?? null;

  for (const [enemyId, node] of enemyNodes.entries()) {
    const active = mode === BATTLE_MODES.targeting || (drag && drag.node.card?.targetType === 'enemy');
    const hovered = hoveredEnemyId === enemyId || !!node.hovered;
    const targetState = resolveEnemyActorTargetState({ active, hovered });
    setActorNodeTargetState(scene, node, targetState);
  }
}

