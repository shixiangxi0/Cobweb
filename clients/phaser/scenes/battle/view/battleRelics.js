import { COLORS, DEPTH } from '../../../src/constants.js';
import {
  fitParagraphText,
  fitSingleLineText,
} from './battleText.js';
import { setDebugName } from '../support/battleDebug.js';

const FONT_UI = '"Trebuchet MS", "Verdana", sans-serif';
const BAR_DEPTH = DEPTH.flowScreenContent + 6;
const TOOLTIP_DEPTH = BAR_DEPTH + 1;
const SLOT_SPACING = 58;

const RELIC_VISUALS = {
  idle: {
    scale: 1,
    plateFill: 0x120d09,
    plateAlpha: 0.96,
    plateStroke: 0x5e4832,
    plateStrokeAlpha: 0.88,
    ringColor: 0xb08e60,
    ringAlpha: 0.24,
    glowColor: 0xffd36a,
    glowAlpha: 0,
    glyphColor: 0xe5d0a3,
    glyphAlpha: 0.86,
    accentColor: 0xffefc6,
    accentAlpha: 0.36,
    pulse: false,
  },
  hover: {
    scale: 1.08,
    plateFill: 0x17100a,
    plateAlpha: 0.98,
    plateStroke: 0x8f7148,
    plateStrokeAlpha: 0.96,
    ringColor: 0xe1be82,
    ringAlpha: 0.68,
    glowColor: 0xffd36a,
    glowAlpha: 0.14,
    glyphColor: 0xffedc1,
    glyphAlpha: 0.94,
    accentColor: 0xfff4d5,
    accentAlpha: 0.54,
    pulse: false,
  },
  armed: {
    scale: 1.04,
    plateFill: 0x1c1308,
    plateAlpha: 1,
    plateStroke: 0xd3a654,
    plateStrokeAlpha: 1,
    ringColor: 0xffd36a,
    ringAlpha: 0.82,
    glowColor: 0xffd36a,
    glowAlpha: 0.26,
    glyphColor: 0xffefb4,
    glyphAlpha: 1,
    accentColor: 0xfffbdf,
    accentAlpha: 0.72,
    pulse: true,
  },
  armedHover: {
    scale: 1.12,
    plateFill: 0x241707,
    plateAlpha: 1,
    plateStroke: 0xf3c46d,
    plateStrokeAlpha: 1,
    ringColor: 0xffe39b,
    ringAlpha: 0.96,
    glowColor: 0xffdb82,
    glowAlpha: 0.36,
    glyphColor: 0xfff6d0,
    glyphAlpha: 1,
    accentColor: 0xffffff,
    accentAlpha: 0.82,
    pulse: true,
  },
  spent: {
    scale: 1,
    plateFill: 0x120d09,
    plateAlpha: 0.96,
    plateStroke: 0x5e4832,
    plateStrokeAlpha: 0.88,
    ringColor: 0xb08e60,
    ringAlpha: 0.24,
    glowColor: 0xffd36a,
    glowAlpha: 0,
    glyphColor: 0xe5d0a3,
    glyphAlpha: 0.86,
    accentColor: 0xffefc6,
    accentAlpha: 0.36,
    pulse: false,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeNode(node, width, height) {
  if (!node) return;
  node.setSize?.(width, height);
  node.setDisplaySize?.(width, height);
}

function alternatingOffset(index) {
  if (index === 0) return 0;
  const tier = Math.ceil(index / 2);
  return index % 2 === 1 ? -tier : tier;
}

function resolveRelicState(entry, hovered) {
  const baseState = entry?.uiState ?? 'idle';
  if (baseState === 'armed') return hovered ? 'armedHover' : 'armed';
  if (hovered) return 'hover';
  return RELIC_VISUALS[baseState] ? baseState : 'idle';
}

function createTooltip(scene) {
  const root = setDebugName(
    scene.add.container(0, 0).setDepth(TOOLTIP_DEPTH).setVisible(false).setAlpha(0),
    'hud.relicBar.tooltip.root',
  );
  const shadow = setDebugName(
    scene.add.rectangle(0, 4, 284, 108, COLORS.shadow, 0.28),
    'hud.relicBar.tooltip.shadow',
  );
  const bg = setDebugName(
    scene.add.rectangle(0, 0, 284, 108, 0x17110b, 0.97)
      .setStrokeStyle(2, 0x6f5434, 0.92),
    'hud.relicBar.tooltip.bg',
  );
  const accent = setDebugName(
    scene.add.rectangle(0, -34, 244, 2, 0xd2aa62, 0.72),
    'hud.relicBar.tooltip.accent',
  );
  const title = setDebugName(
    scene.add.text(-120, -44, '', {
      fontFamily: FONT_UI,
      fontSize: '16px',
      color: '#fff2cb',
      fontStyle: 'bold',
    }).setOrigin(0, 0),
    'hud.relicBar.tooltip.title',
  );
  const desc = setDebugName(
    scene.add.text(-120, -16, '', {
      fontFamily: FONT_UI,
      fontSize: '13px',
      color: '#e1d3b2',
      wordWrap: { width: 240 },
      lineSpacing: 4,
    }).setOrigin(0, 0),
    'hud.relicBar.tooltip.desc',
  );
  root.add([shadow, bg, accent, title, desc]);

  return {
    root,
    shadow,
    bg,
    accent,
    title,
    desc,
  };
}

function layoutTooltip(tooltip) {
  if (!tooltip) return { width: 284, height: 108 };
  const width = 284;
  const height = Math.max(96, 54 + tooltip.title.height + tooltip.desc.height);
  resizeNode(tooltip.shadow, width, height);
  resizeNode(tooltip.bg, width, height);
  resizeNode(tooltip.accent, width - 40, 2);
  tooltip.title.setPosition(-width / 2 + 22, -height / 2 + 16);
  tooltip.desc.setPosition(-width / 2 + 22, -height / 2 + 42);
  tooltip.accent.setPosition(0, -height / 2 + 34);
  tooltip.shadow.setPosition(0, 4);
  return { width, height };
}

function placeTooltip(bar, node) {
  if (!bar?.tooltip || !node?.container?.active) return;
  const { scene, tooltip } = bar;
  const size = layoutTooltip(tooltip);
  const x = clamp(bar.root.x + node.container.x + 178, size.width / 2 + 16, scene.W - size.width / 2 - 16);
  const y = clamp(bar.root.y + node.container.y, size.height / 2 + 16, scene.H - size.height / 2 - 16);
  tooltip.root.setPosition(x, y);
}

function showTooltip(bar, node) {
  if (!bar?.tooltip || !node?.entry) return;
  const freshTarget = bar.tooltipTargetId !== node.entry.id || !bar.tooltip.root.visible;
  const extraLine = node.entry.uiHint ? `\n${node.entry.uiHint}` : '';
  bar.tooltipTargetId = node.entry.id;
  fitSingleLineText(bar.tooltip.title, node.entry.name ?? node.entry.id ?? '遗物', {
    maxWidth: 240,
    minFontSize: 12,
    ellipsis: '...',
  });
  fitParagraphText(bar.tooltip.desc, `${node.entry.desc ?? ''}${extraLine}`.trim(), {
    maxWidth: 240,
    maxHeight: 132,
    maxLines: 6,
    minFontSize: 11,
    ellipsis: '...',
  });
  placeTooltip(bar, node);
  bar.tooltip.root.setVisible(true);
  bar.tooltip.root.scene.tweens.killTweensOf(bar.tooltip.root);
  if (freshTarget) {
    bar.tooltip.root.setAlpha(0);
  }
  bar.tooltip.root.scene.tweens.add({
    targets: bar.tooltip.root,
    alpha: 1,
    duration: 120,
    ease: 'Quad.Out',
  });
}

function hideTooltip(bar) {
  if (!bar?.tooltip) return;
  bar.tooltipTargetId = null;
  bar.tooltip.root.scene.tweens.killTweensOf(bar.tooltip.root);
  bar.tooltip.root.setAlpha(0).setVisible(false);
}

function drawDefaultGlyph(graphics, stroke, accent, strokeAlpha, accentAlpha) {
  graphics.lineStyle(2.2, stroke, strokeAlpha);
  graphics.strokeCircle(0, 0, 12);
  graphics.lineStyle(1.4, accent, accentAlpha);
  graphics.beginPath();
  graphics.moveTo(0, -10);
  graphics.lineTo(8, 0);
  graphics.lineTo(0, 10);
  graphics.lineTo(-8, 0);
  graphics.closePath();
  graphics.strokePath();
  graphics.lineBetween(-10, 0, 10, 0);
  graphics.lineBetween(0, -10, 0, 10);
  graphics.fillStyle(accent, accentAlpha);
  graphics.fillCircle(0, 0, 2.5);
}

function drawMerchantBadgeGlyph(graphics, stroke, accent, strokeAlpha, accentAlpha) {
  graphics.lineStyle(2.2, stroke, strokeAlpha);
  graphics.beginPath();
  graphics.moveTo(0, -14);
  graphics.lineTo(12, -6);
  graphics.lineTo(10, 8);
  graphics.lineTo(0, 14);
  graphics.lineTo(-10, 8);
  graphics.lineTo(-12, -6);
  graphics.closePath();
  graphics.strokePath();

  graphics.lineStyle(1.6, accent, accentAlpha);
  graphics.strokeCircle(0, -1, 5);
  graphics.lineBetween(-5, 11, -8, 17);
  graphics.lineBetween(5, 11, 8, 17);
  graphics.lineBetween(-4, -1, 4, -1);
  graphics.lineBetween(0, -5, 0, 3);
  graphics.fillStyle(accent, accentAlpha);
  graphics.fillCircle(0, -1, 2);
}

function redrawGlyph(node, visual) {
  node.glyph.clear();
  if (node.entry?.id === 'merchant_badge') {
    drawMerchantBadgeGlyph(
      node.glyph,
      visual.glyphColor,
      visual.accentColor,
      visual.glyphAlpha,
      visual.accentAlpha,
    );
    return;
  }
  drawDefaultGlyph(
    node.glyph,
    visual.glyphColor,
    visual.accentColor,
    visual.glyphAlpha,
    visual.accentAlpha,
  );
}

function stopPulse(node) {
  if (!node?.runtime) return;
  node.runtime.pulseTween?.stop?.();
  node.runtime.pulseTween = null;
  node.runtime.pulseState = null;
}

function ensurePulse(node, visual, state) {
  if (!node?.runtime || !visual.pulse) return;
  if (node.runtime.pulseTween && node.runtime.pulseState === state) return;
  stopPulse(node);
  node.runtime.pulseState = state;
  node.runtime.pulseTween = node.container.scene.tweens.add({
    targets: node.glow,
    alpha: Math.max(visual.glowAlpha, 0.24),
    duration: 640,
    ease: 'Sine.InOut',
    yoyo: true,
    repeat: -1,
  });
}

function applyRelicVisual(node, state) {
  if (!node?.container?.active) return;
  const visual = RELIC_VISUALS[state] ?? RELIC_VISUALS.idle;
  const { scene } = node.container;
  const runtime = node.runtime ?? (node.runtime = {});
  runtime.state = state;

  stopPulse(node);
  scene.tweens.killTweensOf(node.container);
  scene.tweens.killTweensOf(node.glow);

  node.plate.setFillStyle(visual.plateFill, visual.plateAlpha);
  node.plate.setStrokeStyle(2, visual.plateStroke, visual.plateStrokeAlpha);
  node.ring.setStrokeStyle(1.4, visual.ringColor, visual.ringAlpha);
  node.glow.setFillStyle(visual.glowColor, 1);
  node.glow.setAlpha(visual.glowAlpha);
  redrawGlyph(node, visual);

  scene.tweens.add({
    targets: node.container,
    scaleX: visual.scale,
    scaleY: visual.scale,
    duration: 140,
    ease: 'Quad.Out',
  });

  if (visual.pulse) {
    ensurePulse(node, visual, state);
  }
}

function drawRail(bar) {
  if (!bar?.rail) return;
  bar.rail.clear();
  if (bar.order.length === 0) return;

  const offsets = bar.order.map((_, index) => alternatingOffset(index) * SLOT_SPACING);
  const minY = Math.min(...offsets);
  const maxY = Math.max(...offsets);

  bar.rail.lineStyle(3, 0x1d140d, 0.88);
  bar.rail.lineBetween(0, minY - 26, 0, maxY + 26);
  bar.rail.lineStyle(1, 0xa48355, 0.3);
  bar.rail.lineBetween(0, minY - 24, 0, maxY + 24);
  offsets.forEach((offsetY) => {
    bar.rail.lineStyle(2, 0x2d2115, 0.92);
    bar.rail.lineBetween(0, offsetY, 12, offsetY);
    bar.rail.lineStyle(1, 0xb8945c, 0.32);
    bar.rail.lineBetween(0, offsetY - 1, 12, offsetY - 1);
  });
}

function createRelicNode(scene, entry, bar) {
  const container = setDebugName(scene.add.container(0, 0), `hud.relicBar.${entry.id}.container`);
  const glow = setDebugName(scene.add.circle(0, 0, 31, 0xffd36a, 0), `hud.relicBar.${entry.id}.glow`);
  const plate = setDebugName(
    scene.add.circle(0, 0, 23, 0x120d09, 0.96)
      .setStrokeStyle(2, 0x5e4832, 0.88),
    `hud.relicBar.${entry.id}.plate`,
  );
  const ring = setDebugName(
    scene.add.circle(0, 0, 16, 0xffffff, 0.001)
      .setStrokeStyle(1.4, 0xb08e60, 0.24),
    `hud.relicBar.${entry.id}.ring`,
  );
  const glyph = setDebugName(scene.add.graphics(), `hud.relicBar.${entry.id}.glyph`);
  const hit = setDebugName(
    scene.add.circle(0, 0, 28, 0x000000, 0.001).setInteractive({ useHandCursor: true }),
    `hud.relicBar.${entry.id}.hit`,
  );

  container.add([glow, plate, ring, glyph, hit]);
  bar.root.add(container);

  const node = {
    entry,
    container,
    glow,
    plate,
    ring,
    glyph,
    hit,
    runtime: {
      state: 'idle',
      pulseTween: null,
      pulseState: null,
    },
  };

  hit.on('pointerover', () => {
    bar.hoveredId = entry.id;
    const node = bar.nodes.get(entry.id);
    if (node) {
      const nextState = resolveRelicState(node.entry, true);
      if (node.runtime?.state !== nextState) {
        applyRelicVisual(node, nextState);
      }
      showTooltip(bar, node);
    }
  });
  hit.on('pointerout', () => {
    if (bar.hoveredId === entry.id) {
      bar.hoveredId = null;
      hideTooltip(bar);
    }
    const node = bar.nodes.get(entry.id);
    if (node) {
      const nextState = resolveRelicState(node.entry, false);
      if (node.runtime?.state !== nextState) {
        applyRelicVisual(node, nextState);
      }
    }
  });
  hit.on('pointerdown', (_pointer, _localX, _localY, event) => {
    event?.stopPropagation?.();
  });

  applyRelicVisual(node, 'idle');
  return node;
}

function destroyRelicNode(node) {
  if (!node) return;
  stopPulse(node);
  node.container?.scene?.tweens?.killTweensOf?.(node.container);
  node.container?.scene?.tweens?.killTweensOf?.(node.glow);
  node.container?.destroy(true);
}

export function createRelicBar(scene) {
  const root = setDebugName(
    scene.add.container(0, 0).setDepth(BAR_DEPTH).setVisible(false),
    'hud.relicBar.root',
  );
  const rail = setDebugName(scene.add.graphics(), 'hud.relicBar.rail');
  root.add(rail);

  return {
    scene,
    root,
    rail,
    tooltip: createTooltip(scene),
    nodes: new Map(),
    order: [],
    hoveredId: null,
    tooltipTargetId: null,
    viewState: null,
  };
}

export function relayoutRelicBar(scene, bar) {
  if (!scene || !bar) return;
  const anchorX = Math.max(54, Math.round((scene.layout?.bottomZone?.leftCX ?? 96) * 0.58));
  const anchorY = Math.round(scene.H * 0.5);
  bar.root.setPosition(anchorX, anchorY);
  drawRail(bar);
  if (bar.hoveredId) {
    const node = bar.nodes.get(bar.hoveredId);
    if (node) placeTooltip(bar, node);
  }
}

export function syncRelicBar(bar, viewState) {
  if (!bar) return;
  bar.viewState = viewState ?? null;

  const entries = viewState?.run?.relicEntries ?? [];
  const nextIds = new Set(entries.map((entry) => entry.id));

  // 收集要删除的节点（避免遍历中删除）
  const toRemove = [];
  for (const [id, node] of bar.nodes.entries()) {
    if (!nextIds.has(id)) {
      toRemove.push(id);
    }
  }
  for (const id of toRemove) {
    if (bar.hoveredId === id) {
      bar.hoveredId = null;
      hideTooltip(bar);
    }
    const node = bar.nodes.get(id);
    if (node) destroyRelicNode(node);
    bar.nodes.delete(id);
  }

  const nextOrder = entries.map((entry) => entry.id);
  const orderChanged = nextOrder.join(',') !== (bar._lastOrder ?? '');
  bar.order = nextOrder;
  bar.root.setVisible(entries.length > 0);
  if (entries.length === 0) {
    hideTooltip(bar);
    if (orderChanged) {
      drawRail(bar);
      bar._lastOrder = '';
    }
    return;
  }

  entries.forEach((entry, index) => {
    let node = bar.nodes.get(entry.id);
    if (!node) {
      node = createRelicNode(bar.scene, entry, bar);
      bar.nodes.set(entry.id, node);
    }
    node.entry = entry;

    const offsetY = alternatingOffset(index) * SLOT_SPACING;
    node.container.setPosition(0, offsetY);

    const nextState = resolveRelicState(entry, bar.hoveredId === entry.id);
    if (node.runtime?.state !== nextState) {
      applyRelicVisual(node, nextState);
    } else if (nextState === 'armed' || nextState === 'armedHover') {
      ensurePulse(node, RELIC_VISUALS[nextState], nextState);
    }
  });

  if (orderChanged) {
    drawRail(bar);
    bar._lastOrder = nextOrder.join(',');
  }

  if (bar.hoveredId) {
    const node = bar.nodes.get(bar.hoveredId);
    if (node) {
      showTooltip(bar, node);
    } else {
      hideTooltip(bar);
    }
  } else {
    hideTooltip(bar);
  }
}

