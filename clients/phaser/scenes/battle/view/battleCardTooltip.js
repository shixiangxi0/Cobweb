import { DEPTH } from '../../../src/constants.js';
import { enhanceTextQuality } from '../../../ui/layout/layoutText.js';
import {
  fitParagraphText,
  fitSingleLineText,
} from './battleText.js';
import {
  CARD_FONT_STACKS,
  CARD_TOOLTIP_LAYOUT,
} from './battleCardLayout.js';

const FONT_UI = CARD_FONT_STACKS.ui;
const FONT_DISPLAY = CARD_FONT_STACKS.display;

const CARD_TONES = {
  attack: {
    stroke: 0x3a2b23,
    accent: 0x8b0000,
    paper: 0xf7f1e8,
    ink: '#111111',
    soft: '#66584b',
  },
  skill: {
    stroke: 0x2f322f,
    accent: 0x2f4f4f,
    paper: 0xf7f2e9,
    ink: '#111111',
    soft: '#58605a',
  },
  power: {
    stroke: 0x43351f,
    accent: 0x8b4513,
    paper: 0xf8f2e7,
    ink: '#111111',
    soft: '#6a5b48',
  },
  neutral: {
    stroke: 0x3d3d3d,
    accent: 0x5a4d42,
    paper: 0xf8f3ea,
    ink: '#111111',
    soft: '#666666',
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

function resolveTone(card) {
  return CARD_TONES[card?.display?.type] ?? CARD_TONES.neutral;
}

function createSeal(scene) {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x111111, 0.9);
  graphics.fillCircle(0, 0, 17);
  graphics.fillStyle(0xf8f4eb, 0.98);
  graphics.fillCircle(0, 0, 12.5);
  graphics.lineStyle(1.2, 0x111111, 0.4);
  graphics.strokeCircle(0, 0, 11.5);
  graphics.fillStyle(0x8b0000, 0.42);
  graphics.fillCircle(8, 8, 2.4);
  return graphics;
}

function layoutTooltip(tooltip) {
  const width = CARD_TOOLTIP_LAYOUT.width;
  const height = Math.max(CARD_TOOLTIP_LAYOUT.minHeight, 86 + tooltip.desc.height);

  resizeNode(tooltip.shadow, width + 6, height + 8);
  resizeNode(tooltip.bg, width, height);
  resizeNode(tooltip.border, width, height);
  resizeNode(tooltip.topRule, width - 26, 1.5);
  resizeNode(tooltip.bottomRule, width - 26, 1);
  resizeNode(
    tooltip.accentBar,
    CARD_TOOLTIP_LAYOUT.accentBar.width,
    height - CARD_TOOLTIP_LAYOUT.accentBar.insetY * 2,
  );

  tooltip.shadow.setPosition(0, CARD_TOOLTIP_LAYOUT.shadowOffsetY);
  tooltip.bg.setPosition(0, 0);
  tooltip.border.setPosition(0, 0);
  tooltip.accentBar.setPosition(-width / 2 + CARD_TOOLTIP_LAYOUT.accentBar.insetX, 0);
  tooltip.topRule.setPosition(0, -height / 2 + CARD_TOOLTIP_LAYOUT.rules.topY);
  tooltip.bottomRule.setPosition(0, height / 2 - CARD_TOOLTIP_LAYOUT.rules.bottomInset);
  tooltip.seal.setPosition(-width / 2 + CARD_TOOLTIP_LAYOUT.seal.x, -height / 2 + CARD_TOOLTIP_LAYOUT.seal.y);
  tooltip.costText.setPosition(-width / 2 + CARD_TOOLTIP_LAYOUT.cost.x, -height / 2 + CARD_TOOLTIP_LAYOUT.cost.y);
  tooltip.title.setPosition(-width / 2 + CARD_TOOLTIP_LAYOUT.title.x, -height / 2 + CARD_TOOLTIP_LAYOUT.title.y);
  tooltip.desc.setPosition(-width / 2 + CARD_TOOLTIP_LAYOUT.description.x, -height / 2 + CARD_TOOLTIP_LAYOUT.description.y);

  return { width, height };
}

function placeTooltip(tooltip, anchor) {
  const scene = tooltip.root.scene;
  const { width, height } = layoutTooltip(tooltip);
  const worldX = anchor?.container?.x ?? scene.W / 2;
  const topY = scene.layout?.bottomZone?.top ?? (scene.H - 240);
  const x = clamp(worldX, width / 2 + 22, scene.W - width / 2 - 22);
  const y = clamp(topY - height / 2 - 20, height / 2 + 18, scene.H - height / 2 - 18);
  tooltip.root.setPosition(x, y);
}

export function createCardTooltip(scene) {
  const root = scene.add.container(0, 0)
    .setDepth(DEPTH.floatingText + 8)
    .setVisible(false)
    .setAlpha(0);

  const shadow = scene.add.rectangle(0, 0, CARD_TOOLTIP_LAYOUT.width + 6, 164, 0x000000, 0.2);
  const bg = scene.add.rectangle(0, 0, CARD_TOOLTIP_LAYOUT.width, 164, 0xf8f4eb, 0.97);
  const border = scene.add.rectangle(0, 0, CARD_TOOLTIP_LAYOUT.width, 164, 0xffffff, 0)
    .setStrokeStyle(1.5, 0x2d2d2d, 0.72);
  const accentBar = scene.add.rectangle(0, 0, CARD_TOOLTIP_LAYOUT.accentBar.width, 140, 0x8b0000, 0.6);
  const topRule = scene.add.rectangle(0, 0, CARD_TOOLTIP_LAYOUT.width - 26, 1.5, 0x2d2d2d, 0.22);
  const bottomRule = scene.add.rectangle(0, 0, CARD_TOOLTIP_LAYOUT.width - 26, 1, 0x2d2d2d, 0.12);
  const seal = createSeal(scene);
  const costText = scene.add.text(0, 0, '0', {
    fontFamily: FONT_DISPLAY,
    fontSize: '18px',
    color: '#111111',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const title = scene.add.text(0, 0, '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '16px',
    color: '#111111',
    fontStyle: 'bold',
  }).setOrigin(0, 0);
  const desc = scene.add.text(0, 0, '', {
    fontFamily: FONT_UI,
    fontSize: '13px',
    color: '#111111',
    wordWrap: { width: CARD_TOOLTIP_LAYOUT.description.maxWidth, useAdvancedWrap: true },
    lineSpacing: 4,
    align: 'left',
  }).setOrigin(0, 0);
  enhanceTextQuality(costText, {
    style: { fontFamily: FONT_DISPLAY, fontSize: '18px' },
    shadowColor: 'rgba(20, 12, 8, 0.16)',
  });
  enhanceTextQuality(title, {
    style: { fontFamily: FONT_DISPLAY, fontSize: '16px' },
    shadowColor: 'rgba(20, 12, 8, 0.16)',
  });
  enhanceTextQuality(desc, {
    mode: 'multi',
    style: { fontFamily: FONT_UI, fontSize: '13px' },
    shadowColor: 'rgba(0, 0, 0, 0.12)',
  });

  root.add([shadow, bg, border, accentBar, topRule, bottomRule, seal, costText, title, desc]);

  return {
    root,
    shadow,
    bg,
    border,
    accentBar,
    topRule,
    bottomRule,
    seal,
    costText,
    title,
    desc,
    cardInstanceId: null,
  };
}

export function showCardTooltip(tooltip, anchor, card = anchor?.card ?? null) {
  if (!tooltip?.root?.active || !card) return;
  const tone = resolveTone(card);

  tooltip.cardInstanceId = card.instanceId ?? null;
  tooltip.bg.setFillStyle(tone.paper, 0.97);
  tooltip.border.setStrokeStyle(1.5, tone.stroke, 0.72);
  tooltip.accentBar.setFillStyle(tone.accent, 0.62);
  tooltip.topRule.setFillStyle(tone.stroke, 0.22);
  tooltip.bottomRule.setFillStyle(tone.stroke, 0.12);
  tooltip.title.setColor(tone.ink);
  tooltip.costText.setColor(tone.ink);

  fitSingleLineText(tooltip.title, card.display?.name ?? card.cardId ?? '卡牌', {
    maxWidth: CARD_TOOLTIP_LAYOUT.title.maxWidth,
    minFontSize: CARD_TOOLTIP_LAYOUT.title.minFontSize,
    ellipsis: '...',
  });
  tooltip.costText.setText(String(card.cost ?? 0));
  fitParagraphText(tooltip.desc, card.display?.desc ?? '', {
    maxWidth: CARD_TOOLTIP_LAYOUT.description.maxWidth,
    maxHeight: CARD_TOOLTIP_LAYOUT.description.maxHeight,
    maxLines: CARD_TOOLTIP_LAYOUT.description.maxLines,
    minFontSize: CARD_TOOLTIP_LAYOUT.description.minFontSize,
    ellipsis: '...',
  });

  placeTooltip(tooltip, anchor);
  tooltip.root.setVisible(true);
  tooltip.root.scene.tweens.killTweensOf(tooltip.root);
  tooltip.root.setAlpha(0).setScale(0.98);
  tooltip.root.scene.tweens.add({
    targets: tooltip.root,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 110,
    ease: 'Quad.Out',
  });
}

export function hideCardTooltip(tooltip) {
  if (!tooltip?.root) return;
  tooltip.cardInstanceId = null;
  tooltip.root.scene.tweens.killTweensOf(tooltip.root);
  tooltip.root.setAlpha(0).setVisible(false);
}

