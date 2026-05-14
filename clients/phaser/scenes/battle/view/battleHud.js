import { BATTLE_MODES } from '../state/battleModeState.js';
import {
  pulseSkinnedTurnPlate,
  setSkinnedEndTurnButtonState,
} from './battleSkin.js';
import { syncRelicBar } from './battleRelics.js';
import { updatePileWidget } from './battleViews.js';

const ENERGY_BADGE_STATES = {
  steady: {
    shellFill: 0x24352a,
    shellAlpha: 0.96,
    coreFill: 0xf2dd9d,
    coreAlpha: 1,
    glowAlpha: 0.16,
    scale: 1,
  },
  gain: {
    shellFill: 0x2f4734,
    shellAlpha: 0.98,
    coreFill: 0xffe7a8,
    coreAlpha: 1,
    glowAlpha: 0.4,
    scale: 1.08,
  },
  spend: {
    shellFill: 0x3a3028,
    shellAlpha: 0.98,
    coreFill: 0xe8ca8f,
    coreAlpha: 1,
    glowAlpha: 0.26,
    scale: 1.05,
  },
};

function ensureTurnPlateRuntime(ui) {
  const plate = ui?.turnPlate;
  if (!plate) return null;
  if (!plate.runtime) {
    plate.runtime = {
      state: 'steady',
      text: plate.lastText ?? plate.label?.text ?? '',
      floorText: plate.floorLabel?.text ?? '',
    };
  }
  return plate.runtime;
}

function syncTurnPlate(ui, turn, floorLabel = '') {
  const plate = ui?.turnPlate;
  const label = plate?.label;
  if (!plate || !label) return;

  const nextTurnText = `第 ${turn} 回`;
  const runtime = ensureTurnPlateRuntime(ui);
  if (!runtime) return;

  if (runtime.text === nextTurnText) {
    label.setText(nextTurnText);
  } else {
    runtime.state = 'pulse';
    runtime.text = nextTurnText;
    pulseSkinnedTurnPlate(label.scene, plate, nextTurnText);
    runtime.state = 'steady';
  }

  const nextFloorText = floorLabel || '深渊试炼';
  if (runtime.floorText !== nextFloorText) {
    runtime.floorText = nextFloorText;
    plate.floorLabel?.setText(nextFloorText);
  }
}

function ensureEnergyBadgeRuntime(ui) {
  const badge = ui?.energyBadge;
  if (!badge) return null;
  if (!badge.runtime) {
    badge.runtime = {
      state: 'steady',
      energy: null,
      maxEnergy: null,
      text: ui.energyText?.text ?? '',
    };
  }
  return badge.runtime;
}

function applyEnergyBadgeVisual(ui, state = 'steady') {
  const visual = ENERGY_BADGE_STATES[state] ?? ENERGY_BADGE_STATES.steady;
  ui.energyShell?.setFillStyle(visual.shellFill, visual.shellAlpha);
  ui.energyCore?.setFillStyle(visual.coreFill, visual.coreAlpha);
  ui.energyGlow?.setAlpha(visual.glowAlpha);
  ui.energyBadge?.setScale(visual.scale);
}

function pulseEnergyBadge(ui, state) {
  if (!ui?.energyBadge?.active) return;

  const visual = ENERGY_BADGE_STATES[state] ?? ENERGY_BADGE_STATES.steady;
  const steady = ENERGY_BADGE_STATES.steady;
  const { scene } = ui.energyBadge;

  ui.energyShell?.setFillStyle(visual.shellFill, visual.shellAlpha);
  ui.energyCore?.setFillStyle(visual.coreFill, visual.coreAlpha);
  scene.tweens.killTweensOf(ui.energyBadge);
  scene.tweens.killTweensOf(ui.energyGlow);
  ui.energyBadge.setScale(steady.scale);
  ui.energyGlow?.setAlpha(steady.glowAlpha);

  scene.tweens.add({
    targets: ui.energyBadge,
    scaleX: visual.scale,
    scaleY: visual.scale,
    duration: 140,
    ease: 'Quad.Out',
    yoyo: true,
    onComplete: () => applyEnergyBadgeVisual(ui, 'steady'),
  });

  if (ui.energyGlow) {
    scene.tweens.add({
      targets: ui.energyGlow,
      alpha: visual.glowAlpha,
      duration: 140,
      ease: 'Quad.Out',
      yoyo: true,
      onComplete: () => {
        if (ui.energyGlow?.active) ui.energyGlow.setAlpha(steady.glowAlpha);
      },
    });
  }
}

function syncEnergyBadge(ui, player) {
  const runtime = ensureEnergyBadgeRuntime(ui);
  if (!runtime) return;

  const maxEnergy = Math.max(0, player?.maxEnergy ?? 0);
  const energy = Math.max(0, player?.energy ?? 0);
  const energyText = maxEnergy > 0 ? `${energy} / ${maxEnergy}` : `${energy}`;
  const firstSync = runtime.energy == null && runtime.maxEnergy == null;
  const changed = runtime.energy !== energy || runtime.maxEnergy !== maxEnergy || runtime.text !== energyText;

  runtime.energy = energy;
  runtime.maxEnergy = maxEnergy;
  runtime.text = energyText;
  ui.energyText?.setText(energyText);

  if (firstSync || !changed) {
    runtime.state = 'steady';
    applyEnergyBadgeVisual(ui, 'steady');
    return;
  }

  runtime.state = energy > (runtime.prevEnergy ?? energy)
    || maxEnergy > (runtime.prevMaxEnergy ?? maxEnergy)
    ? 'gain'
    : 'spend';
  pulseEnergyBadge(ui, runtime.state);
  runtime.state = 'steady';
}

export function syncBattleHud(ui, vs) {
  if (!ui || !vs) return;

  const energyRuntime = ensureEnergyBadgeRuntime(ui);
  if (energyRuntime) {
    energyRuntime.prevEnergy = energyRuntime.energy;
    energyRuntime.prevMaxEnergy = energyRuntime.maxEnergy;
  }

  syncTurnPlate(ui, vs.turn, vs.run?.progress?.label);
  syncEnergyBadge(ui, vs.player);

  // 只有 relic 列表真正变化时才重建 relic bar
  const relicEntries = vs.run?.relicEntries ?? [];
  const nextSig = relicEntries.map((e) => e.id).join(',');
  if (ui.relicBar?._lastRelicSig !== nextSig) {
    syncRelicBar(ui.relicBar, vs);
    if (ui.relicBar) ui.relicBar._lastRelicSig = nextSig;
  }
}

export function syncBattlePiles(ui, piles) {
  updatePileWidget(ui.drawPile, piles?.draw);
  updatePileWidget(ui.discardPile, piles?.discard);
  updatePileWidget(ui.exhaustPile, piles?.exhaust);
}

export function refreshEndTurnButton(ui, mode, hovered = ui?.endTurnSkin?.hovered ?? false) {
  const enabled = mode === BATTLE_MODES.idle;
  setSkinnedEndTurnButtonState(ui?.endTurnSkin, { enabled, hovered });
  ui?.endTurnSkin?.label?.setAlpha(enabled ? 1 : 0.72);
}

