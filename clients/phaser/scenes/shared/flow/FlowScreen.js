import { createSkinnedCardBase } from '../../battle/view/battleSkin.js';
import {
  fitParagraphText,
  fitSingleLineText,
} from '../../battle/view/battleText.js';
import { createLayoutText } from '../../../ui/layout/index.js';
import { setDebugName } from '../../battle/support/battleDebug.js';
import { DEPTH } from '../../../src/constants.js';
import { rewardPhaseController } from './phaseUi/RewardPhaseController.js';
import { shopPhaseController } from './phaseUi/ShopPhaseController.js';

const FONT_DISPLAY = '"Georgia", "Times New Roman", serif';
const FONT_UI = '"Trebuchet MS", "Verdana", sans-serif';
const SCREEN_THEMES = {
  victory: {
    backdrop: 0x090807,
    glowA: 0xc79a58,
    glowB: 0x2d2217,
    panel: 0x11100e,
    frame: 0x665238,
    accent: 0xc79a58,
    accentDark: 0x2a2117,
    text: '#efe0bf',
    soft: '#a88f69',
  },
  reward: {
    backdrop: 0x090807,
    glowA: 0xc79a58,
    glowB: 0x2d2217,
    panel: 0x11100e,
    frame: 0x665238,
    accent: 0xc79a58,
    accentDark: 0x2a2117,
    text: '#efe0bf',
    soft: '#a88f69',
  },
  shop: {
    backdrop: 0x090807,
    glowA: 0xc79a58,
    glowB: 0x31261a,
    panel: 0x11100e,
    frame: 0x60513d,
    accent: 0xb89156,
    accentDark: 0x251d14,
    text: '#ece0c5',
    soft: '#a29279',
  },
  defeat: {
    backdrop: 0x120c0c,
    glowA: 0x9a635d,
    glowB: 0x3a2320,
    panel: 0x161010,
    frame: 0x69433f,
    accent: 0x9a635d,
    accentDark: 0x2b1b19,
    text: '#ead4d1',
    soft: '#ad8680',
  },
};
const BUTTON_PALETTES = {
  primary: {
    fill: 0x1e4230,    // deep dungeon green
    stroke: 0x0e2a1c,
    text: '#c0e8d0',
  },
  secondary: {
    fill: 0x2a1e12,    // dark stone
    stroke: 0x5c3220,
    text: '#c8a870',   // amber — readable on dark stone
  },
  danger: {
    fill: 0x4a2220,    // deep ember red
    stroke: 0x3a1612,
    text: '#e8c0c0',
  },
};
const PHASE_CONTROLLERS = [
  rewardPhaseController,
  shopPhaseController,
];
const FLOW_STEP_KINDS = new Set([
  'relic_acquire',
  ...PHASE_CONTROLLERS.flatMap((controller) => controller.stepKinds ?? []),
]);
const FLOW_PHASES = {
  hidden: 'hidden',
  prepared: 'prepared',
  entering: 'entering',
  idle: 'idle',
  resolving: 'resolving',
  exiting: 'exiting',
};

export function isFlowStep(step) {
  return FLOW_STEP_KINDS.has(step?.kind);
}

function badgeGlyph(text = '') {
  return String(text).trim().slice(0, 1) || '?';
}

function cardTypeLabel(type) {
  if (type === 'attack') return '攻击';
  if (type === 'power') return '能力';
  return '技能';
}

function cardRarityLabel(rarity) {
  if (rarity === 'rare') return '稀有';
  if (rarity === 'uncommon') return '进阶';
  return '普通';
}

function flowTheme(kind) {
  if (kind === 'shop' || kind === 'journey') return SCREEN_THEMES.shop;
  if (kind === 'reward') return SCREEN_THEMES.reward;
  if (kind === 'defeat') return SCREEN_THEMES.defeat;
  return SCREEN_THEMES.victory;
}

function clearEffectRoot(screen) {
  screen?.effectRoot?.removeAll?.(true);
  if (screen?.effectRoot) {
    screen.effectRoot.setVisible(false);
  }
}

function resetOfferNodes(screen) {
  if (!screen) return;
  screen.offerNodes = new Map();
}

function clearOfferNodes(screen) {
  if (!screen) return;
  for (const key of screen.offerNodes.keys()) {
    screen.interactionNodes?.delete?.(String(key));
  }
  resetOfferNodes(screen);
}

function resetInteractionNodes(screen) {
  if (!screen) return;
  screen.interactionNodes = new Map();
}

function attachBlockedHandler(node, applyBlocked) {
  if (!node || typeof applyBlocked !== 'function') return node;
  node.__flowApplyBlocked = applyBlocked;
  return node;
}

function registerInteractiveNode(screen, key, node) {
  if (!screen || !node || key == null) return node;
  if (typeof node.__flowApplyBlocked !== 'function') return node;
  screen.interactionNodes.set(String(key), node);
  node.__flowApplyBlocked(!!screen.blocked);
  return node;
}

function registerOfferNode(screen, key, node) {
  if (!screen || !node || key == null) return node;
  node.__flowBaseY = node.y ?? 0;
  node.__flowBaseScaleX = node.scaleX ?? 1;
  node.__flowBaseScaleY = node.scaleY ?? 1;
  screen.offerNodes.set(String(key), node);
  registerInteractiveNode(screen, key, node);
  return node;
}

function updateInteractionState(screen, blocked = false) {
  if (!screen) return;
  screen.blocked = !!blocked;
  for (const node of screen.interactionNodes.values()) {
    node.__flowApplyBlocked?.(screen.blocked);
  }
}

function prepareHiddenLayout(screen) {
  if (!screen?.root || !screen?.backdrop) return;
  screen.backdrop.setAlpha(0);
  screen.root.setAlpha(0).setScale(0.985).setY(18);
  for (const node of screen.offerNodes.values()) {
    node.setAlpha(0);
    node.setY((node.__flowBaseY ?? node.y ?? 0) + 16);
    node.setScale(node.__flowBaseScaleX ?? node.scaleX ?? 1, node.__flowBaseScaleY ?? node.scaleY ?? 1);
  }
}

function restoreVisibleLayout(screen) {
  if (!screen?.root || !screen?.backdrop) return;
  screen.backdrop.setAlpha(1);
  screen.root.setAlpha(1).setScale(1).setY(0);
  for (const node of screen.offerNodes.values()) {
    node.setAlpha(1);
    node.setY(node.__flowBaseY ?? node.y ?? 0);
    node.setScale(node.__flowBaseScaleX ?? node.scaleX ?? 1, node.__flowBaseScaleY ?? node.scaleY ?? 1);
  }
}

function getOfferNode(screen, key) {
  if (!screen || key == null) return null;
  return screen.offerNodes?.get(String(key)) ?? null;
}

function createPanelGraphic(scene, {
  width,
  height,
  fill,
  stroke,
  radius = 26,
}) {
  const graphics = scene.add.graphics();
  graphics.fillStyle(fill, 0.96);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  graphics.lineStyle(2, stroke, 0.72);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  // torch-bevel top edge instead of web inner-highlight ring
  graphics.lineStyle(1, 0x7a4828, 0.26);
  graphics.lineBetween(-width / 2 + radius, -height / 2 + 3, width / 2 - radius, -height / 2 + 3);
  return graphics;
}

function createHeader(scene, spec, theme) {
  const width = Math.min(scene.W - 88, 880);
  const hasSubtitle = !!spec.subtitle;
  const height = hasSubtitle ? 76 : 66;
  const container = scene.add.container(scene.W / 2, 60);
  const shadow = scene.add.rectangle(0, 8, width + 10, height + 8, 0x000000, 0.16);
  const panel = createPanelGraphic(scene, {
    width,
    height,
    fill: theme.panel,
    stroke: theme.frame,
    radius: 18,
  });
  const title = createLayoutText(scene, spec.title, {
    style: {
      fontFamily: FONT_DISPLAY,
      fontSize: '24px',
      color: theme.text,
      fontStyle: 'bold',
    },
    constraints: { maxWidth: width - (spec.goldText ? 196 : 48), minFontSize: 18, ellipsis: '...' },
    mode: 'single',
  }).setOrigin(0, 0.5);
  title.setPosition(-width / 2 + 24, hasSubtitle ? -14 : -10);
  container.add([shadow, panel, title]);
  let subtitle = null;
  let goldText = null;

  if (spec.subtitle) {
    subtitle = createLayoutText(scene, spec.subtitle, {
      style: {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: theme.soft,
        wordWrap: { width: width - 220 },
        lineSpacing: 2,
      },
      constraints: { maxWidth: width - 220, maxHeight: 30, maxLines: 2, minFontSize: 11, ellipsis: '...' },
      mode: 'multi',
    }).setOrigin(0, 0.5);
    subtitle.setPosition(-width / 2 + 24, hasSubtitle ? 14 : 12);
    container.add(subtitle);
  }

  if (spec.goldText) {
    const goldBadge = scene.add.container(width / 2 - 84, 0);
    const goldBg = scene.add.rectangle(0, 0, 132, 34, theme.accentDark, 1)
      .setStrokeStyle(2, theme.frame, 0.9);
    goldText = createLayoutText(scene, spec.goldText, {
      style: {
        fontFamily: FONT_UI,
        fontSize: '15px',
        color: '#fff8ec',
        fontStyle: 'bold',
      },
      constraints: { maxWidth: 116, minFontSize: 11, ellipsis: '...' },
      mode: 'single',
    }).setOrigin(0.5);
    goldBadge.add([goldBg, goldText]);
    container.add(goldBadge);
  }

  container.__flowHeader = {
    width,
    hasSubtitle,
    hasGoldText: !!spec.goldText,
    title,
    subtitle,
    goldText,
  };
  setDebugName(container, 'flow.header');
  return container;
}

function syncHeader(header, spec) {
  const refs = header?.__flowHeader ?? null;
  if (!refs) return false;
  if (refs.hasSubtitle !== !!spec.subtitle) return false;
  if (refs.hasGoldText !== !!spec.goldText) return false;

  refs.title.setText(spec.title);
  refs.title.__layout.measure(refs.width - (spec.goldText ? 196 : 48), Infinity);

  if (refs.subtitle) {
    refs.subtitle.setText(spec.subtitle ?? '');
    refs.subtitle.__layout.measure(refs.width - 220, 30);
  }

  if (refs.goldText) {
    refs.goldText.setText(spec.goldText ?? '');
    refs.goldText.__layout.measure(116, Infinity);
  }

  return true;
}

function createSectionLabel(scene, {
  x,
  y,
  text,
  theme,
  width = 180,
}) {
  const container = scene.add.container(x, y);
  const line = scene.add.rectangle(0, 0, width, 2, theme.frame, 0.45);
  const chip = scene.add.rectangle(0, 0, Math.min(width, 112), 24, theme.accentDark, 1)
    .setStrokeStyle(1, theme.frame, 0.72);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: theme.text,
    fontStyle: 'bold',
    letterSpacing: 1,
  }).setOrigin(0.5);
  fitSingleLineText(label, text, {
    maxWidth: Math.min(width, 112) - 12,
    minFontSize: 9,
    ellipsis: '...',
  });
  container.add([line, chip, label]);
  return container;
}

function createSceneHero(scene, {
  x,
  y,
  width,
  eyebrow = '',
  title,
  summary = '',
  emblem = '',
  theme,
  debugName = '',
}) {
  const container = scene.add.container(x, y);
  const height = summary ? 82 : 66;
  const shadow = scene.add.rectangle(0, 4, width, height, 0x000000, 0.14);
  const bg = scene.add.rectangle(0, 0, width, height, theme.accentDark, 0.58)
    .setStrokeStyle(1, theme.frame, 0.3);
  const leftGlow = scene.add.circle(-width / 2 + 58, 0, 42, theme.accent, 0.08);
  const emblemRing = scene.add.circle(-width / 2 + 58, 0, 25, theme.accent, 1)
    .setStrokeStyle(2, theme.frame, 0.92);
  const emblemCore = scene.add.circle(-width / 2 + 58, 0, 18, 0x130f0a, 1);
  const emblemText = scene.add.text(-width / 2 + 58, -1, emblem || '·', {
    fontFamily: FONT_DISPLAY,
    fontSize: '20px',
    color: theme.text,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const eyebrowText = scene.add.text(-width / 2 + 96, summary ? -18 : -10, eyebrow, {
    fontFamily: FONT_UI,
    fontSize: '10px',
    color: theme.soft,
    fontStyle: 'bold',
    letterSpacing: 2,
  }).setOrigin(0, 0.5);
  const titleText = scene.add.text(-width / 2 + 96, summary ? -1 : 10, title, {
    fontFamily: FONT_DISPLAY,
    fontSize: '22px',
    color: theme.text,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  fitSingleLineText(eyebrowText, eyebrow, {
    maxWidth: width - 134,
    minFontSize: 8,
    ellipsis: '...',
  });
  fitSingleLineText(titleText, title, {
    maxWidth: width - 134,
    minFontSize: 16,
    ellipsis: '...',
  });

  container.add([
    shadow,
    bg,
    leftGlow,
    emblemRing,
    emblemCore,
    emblemText,
    eyebrowText,
    titleText,
  ]);

  if (summary) {
    const summaryText = scene.add.text(-width / 2 + 96, 22, summary, {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: theme.soft,
      lineSpacing: 2,
    }).setOrigin(0, 0.5);
    fitParagraphText(summaryText, summary, {
      maxWidth: width - 134,
      maxHeight: 34,
      maxLines: 2,
      minFontSize: 10,
      ellipsis: '...',
    });
    container.add(summaryText);
  }

  if (debugName) setDebugName(container, debugName);
  return container;
}

function createNoticeBanner(scene, {
  x,
  y,
  width,
  text,
  theme,
  accent = false,
  debugName = '',
}) {
  const container = scene.add.container(x, y);
  const fill = accent ? 0x20160d : 0x17110c;
  const stroke = accent ? theme.accent : theme.frame;
  const textColor = accent ? '#f6e5c3' : theme.soft;
  const shadow = scene.add.rectangle(0, 5, width, 44, 0x000000, 0.14);
  const bg = scene.add.rectangle(0, 0, width, 42, fill, 0.96)
    .setStrokeStyle(2, stroke, 0.84);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONT_UI,
    fontSize: '13px',
    color: textColor,
    align: 'center',
    lineSpacing: 2,
  }).setOrigin(0.5);
  fitParagraphText(label, text, {
    maxWidth: width - 28,
    maxHeight: 28,
    maxLines: 2,
    minFontSize: 10,
    ellipsis: '...',
  });
  container.add([shadow, bg, label]);
  if (debugName) setDebugName(container, debugName);
  return container;
}

function createActionButton(scene, {
  x,
  y,
  width,
  label,
  kind = 'primary',
  baseEnabled = true,
  blocked = false,
  onClick = null,
  debugName = '',
}) {
  const palette = BUTTON_PALETTES[kind] ?? BUTTON_PALETTES.primary;
  const container = scene.add.container(x, y);
  const baseAlpha = container.alpha ?? 1;
  const shadow = scene.add.rectangle(0, 8, width, 52, 0x000000, 0.16);
  const bg = scene.add.rectangle(0, 0, width, 52, palette.fill, 1)
    .setStrokeStyle(3, palette.stroke, 0.94);
  const band = scene.add.rectangle(0, -10, width - 18, 12, 0xffffff, 0.14);
  const labelText = createLayoutText(scene, label, {
    style: {
      fontFamily: FONT_UI,
      fontSize: '18px',
      color: palette.text,
      fontStyle: 'bold',
      letterSpacing: 1,
    },
    constraints: { maxWidth: width - 24, minFontSize: 13, ellipsis: '...' },
    mode: 'single',
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, width, 52, 0xffffff, 0.001);
  let active = false;

  const resetHover = () => {
    scene.tweens.killTweensOf(container);
    container.setScale(1);
  };
  const setEnabled = (enabled) => {
    active = !!enabled;
    if (active) {
      container.setAlpha(baseAlpha);
      bg.setFillStyle(palette.fill, 1);
      bg.setStrokeStyle(3, palette.stroke, 0.94);
      band.setAlpha(0.14);
      labelText.setColor(palette.text);
      hit.setInteractive({ useHandCursor: true });
      return;
    }

    if (hit.input) hit.disableInteractive();
    resetHover();
    container.setAlpha(baseAlpha * 0.7);
    bg.setFillStyle(0xb1a79b, 1);
    bg.setStrokeStyle(3, 0x72685d, 0.94);
    band.setAlpha(0.06);
    labelText.setColor('#e6ddd3');
  };

  hit.on('pointerdown', (_pointer, _localX, _localY, event) => {
    if (!active) return;
    event?.stopPropagation?.();
    onClick?.();
  });
  hit.on('pointerover', () => {
    if (!active) return;
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 120,
      ease: 'Quad.Out',
    });
  });
  hit.on('pointerout', () => {
    if (!active) return;
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 120,
      ease: 'Quad.Out',
    });
  });

  container.add([shadow, bg, band, labelText, hit]);
  attachBlockedHandler(container, (nextBlocked) => {
    setEnabled(baseEnabled && !nextBlocked && onClick != null);
  });
  container.__flowApplyBlocked?.(blocked);
  if (debugName) setDebugName(container, debugName);
  return container;
}

function enableInteractiveLift(scene, {
  container,
  hit,
  baseEnabled = true,
  blocked = false,
  hoverScale = 1.04,
  hoverLift = 8,
  onClick = null,
  onHoverChange = null,
}) {
  const baseAlpha = container.alpha ?? 1;
  const baseScaleX = container.scaleX || 1;
  const baseScaleY = container.scaleY || 1;
  const baseY = container.y ?? 0;
  let active = false;

  const resetHover = () => {
    scene.tweens.killTweensOf(container);
    container.setScale(baseScaleX, baseScaleY);
    container.setY(baseY);
    onHoverChange?.(false);
  };
  const setEnabled = (enabled) => {
    active = !!enabled;
    if (active) {
      container.setAlpha(baseAlpha);
      hit.setInteractive({ useHandCursor: true });
      return;
    }

    if (hit.input) hit.disableInteractive();
    resetHover();
    container.setAlpha(baseAlpha * 0.56);
  };

  hit.on('pointerdown', (_pointer, _localX, _localY, event) => {
    if (!active) return;
    event?.stopPropagation?.();
    onClick?.();
  });
  hit.on('pointerover', () => {
    if (!active) return;
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      scaleX: baseScaleX * hoverScale,
      scaleY: baseScaleY * hoverScale,
      y: baseY - hoverLift,
      duration: 140,
      ease: 'Quad.Out',
    });
    onHoverChange?.(true);
  });
  hit.on('pointerout', () => {
    if (!active) return;
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      scaleX: baseScaleX,
      scaleY: baseScaleY,
      y: baseY,
      duration: 140,
      ease: 'Quad.Out',
    });
    onHoverChange?.(false);
  });
  attachBlockedHandler(container, (nextBlocked) => {
    setEnabled(baseEnabled && !nextBlocked);
  });
  container.__flowApplyBlocked?.(blocked);
}

function createPriceTag(scene, {
  x,
  y,
  label,
  subLabel = null,
  tone = 'gold',
}) {
  const palette = tone === 'free'
    ? { fill: 0x2f6e53, stroke: 0x163a2a }
    : { fill: 0x8a6a3d, stroke: 0x4f3821 };
  const container = scene.add.container(x, y);
  const height = subLabel ? 48 : 34;
  const shadow = scene.add.rectangle(0, 5, 92, height, 0x000000, 0.16);
  const bg = scene.add.rectangle(0, 0, 92, height, palette.fill, 1)
    .setStrokeStyle(3, palette.stroke, 0.94);
  const labelText = scene.add.text(0, subLabel ? -7 : 0, label, {
    fontFamily: FONT_UI,
    fontSize: subLabel ? '14px' : '15px',
    color: '#fff8ec',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  fitSingleLineText(labelText, label, {
    maxWidth: 76,
    minFontSize: 10,
    ellipsis: '...',
  });

  container.add([shadow, bg, labelText]);
  if (subLabel) {
    const sub = scene.add.text(0, 11, subLabel, {
      fontFamily: FONT_UI,
      fontSize: '10px',
      color: '#f7e5cb',
    }).setOrigin(0.5);
    fitParagraphText(sub, subLabel, {
      maxWidth: 80,
      maxHeight: 20,
      maxLines: 2,
      minFontSize: 8,
      ellipsis: '...',
    });
    container.add(sub);
  }
  return container;
}

function createCardOffer(scene, offer, {
  x,
  y,
  scale = 1,
  blocked = false,
  onClick = null,
  priceLabel = null,
  priceSubLabel = null,
  debugName = '',
}) {
  const width = 168;
  const height = 226;
  const halfW = width / 2;
  const halfH = height / 2;
  const container = scene.add.container(x, y).setScale(scale);
  const shadow = scene.add.ellipse(0, halfH + 10, width * 0.82, 17, 0x000000, 0.28);
  const skin = createSkinnedCardBase(scene, { type: offer.display?.type ?? offer.type });
  skin.body.setDisplaySize(width, height);
  skin.glow.setDisplaySize(width + 20, height + 20);
  skin.glow.setAlpha(0.08);
  const frame = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.01)
    .setStrokeStyle(2, 0x000000, 0.08);
  const costText = scene.add.text(-halfW + 26, -halfH + 28, String(offer.cost ?? 0), {
    fontFamily: FONT_DISPLAY,
    fontSize: '18px',
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#00000044',
    strokeThickness: 3,
  }).setOrigin(0.5);
  const title = scene.add.text(10, -halfH + 26, offer.name ?? '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '15px',
    color: '#f8f0e0',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const badge = scene.add.text(10, -halfH + 41, `${cardTypeLabel(offer.display?.type ?? offer.type)} · ${cardRarityLabel(offer.rarity)}`, {
    fontFamily: FONT_UI,
    fontSize: '8px',
    color: '#d1c4ae',
    letterSpacing: 1,
  }).setOrigin(0.5);
  const desc = scene.add.text(0, -halfH + 146, offer.desc ?? '', {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: '#d4b890',
    stroke: '#0a0604',
    strokeThickness: 1.5,
    wordWrap: { width: width - 30, useAdvancedWrap: true },
    align: 'center',
    lineSpacing: 2,
  }).setOrigin(0.5, 0);
  fitSingleLineText(title, offer.name ?? '', {
    maxWidth: 100,
    minFontSize: 11,
    ellipsis: '...',
  });
  fitSingleLineText(badge, `${cardTypeLabel(offer.display?.type ?? offer.type)} · ${cardRarityLabel(offer.rarity)}`, {
    maxWidth: 112,
    minFontSize: 8,
    ellipsis: '...',
  });
  fitParagraphText(desc, offer.desc ?? '', {
    maxWidth: width - 30,
    maxHeight: 56,
    maxLines: 4,
    minFontSize: 10,
    ellipsis: '...',
  });
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.001);

  container.add([shadow, skin.glow, skin.body, frame, costText, title, badge, desc]);

  if (priceLabel) {
    const tone = offer.freeEligible ? 'free' : 'gold';
    container.add(createPriceTag(scene, {
      x: halfW - 36,
      y: -halfH + 20,
      label: priceLabel,
      subLabel: priceSubLabel,
      tone,
    }));
  }

  if (offer.canAfford === false) {
    const veil = scene.add.rectangle(0, 0, width, height, 0x201613, 0.18);
    container.add(veil);
  }

  container.add(hit);
  enableInteractiveLift(scene, {
    container,
    hit,
    baseEnabled: onClick != null && offer.canAfford !== false,
    blocked,
    onClick,
    hoverScale: 1.035,
    hoverLift: 8,
    onHoverChange: (active) => {
      scene.tweens.killTweensOf(skin.glow);
      scene.tweens.killTweensOf(shadow);
      scene.tweens.add({
        targets: skin.glow,
        alpha: active ? 0.24 : 0.08,
        duration: 120,
        ease: 'Quad.Out',
      });
      scene.tweens.add({
        targets: shadow,
        alpha: active ? 0.4 : 0.28,
        duration: 120,
        ease: 'Quad.Out',
      });
    },
  });

  if (debugName) setDebugName(container, debugName);
  return container;
}

function createGoldOffer(scene, offer, {
  x,
  y,
  scale = 1,
  blocked = false,
  onClick = null,
  debugName = '',
}) {
  const container = scene.add.container(x, y).setScale(scale);
  const shadow = scene.add.ellipse(0, 104, 148, 17, 0x000000, 0.22);
  const glow = scene.add.circle(0, -12, 78, 0xffd56a, 0.12).setAlpha(0.18);
  const plaque = createPanelGraphic(scene, {
    width: 174,
    height: 198,
    fill: 0x1a1208,    // dark stone (was: cream 0xfff1b8)
    stroke: 0x8a6a3d,
    radius: 28,
  });
  const titleChip = scene.add.rectangle(0, -68, 108, 22, 0xc58f18, 1)
    .setStrokeStyle(2, 0x8a6a3d, 0.24);
  const title = scene.add.text(0, -68, '金币', {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: '#fff8ec',
    fontStyle: 'bold',
    letterSpacing: 2,
  }).setOrigin(0.5);
  const coinBack = scene.add.ellipse(0, -4, 86, 24, 0xd39b29, 1)
    .setStrokeStyle(3, 0x8a6a3d, 0.86);
  const coinLeft = scene.add.ellipse(-24, 12, 54, 16, 0xf0bf52, 1)
    .setStrokeStyle(2, 0x8a6a3d, 0.82);
  const coinCenter = scene.add.ellipse(0, 4, 60, 18, 0xffd56a, 1)
    .setStrokeStyle(2, 0x8a6a3d, 0.82);
  const coinRight = scene.add.ellipse(24, 16, 50, 15, 0xe7b74d, 1)
    .setStrokeStyle(2, 0x8a6a3d, 0.82);
  const amount = scene.add.text(0, 50, `+${offer.amount ?? 0} 金`, {
    fontFamily: FONT_DISPLAY,
    fontSize: '28px',
    color: '#f0d878',   // bright gold on dark stone (was '#5a3814')
    fontStyle: 'bold',
    stroke: '#0a0604',
    strokeThickness: 1,
  }).setOrigin(0.5);
  const desc = scene.add.text(0, 76, offer.desc ?? '', {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: '#a88060',   // warm amber (was '#6b532e')
    wordWrap: { width: 138 },
    align: 'center',
    lineSpacing: 2,
  }).setOrigin(0.5, 0);
  fitParagraphText(desc, offer.desc ?? '', {
    maxWidth: 138,
    maxHeight: 50,
    maxLines: 4,
    minFontSize: 10,
    ellipsis: '...',
  });
  const hit = scene.add.rectangle(0, 0, 174, 198, 0xffffff, 0.001);

  container.add([
    shadow,
    glow,
    plaque,
    titleChip,
    title,
    coinBack,
    coinLeft,
    coinCenter,
    coinRight,
    amount,
    desc,
    hit,
  ]);
  enableInteractiveLift(scene, {
    container,
    hit,
    baseEnabled: onClick != null,
    blocked,
    onClick,
    hoverScale: 1.035,
    hoverLift: 8,
    onHoverChange: (active) => {
      scene.tweens.killTweensOf(glow);
      scene.tweens.add({
        targets: glow,
        alpha: active ? 0.36 : 0.18,
        duration: 120,
        ease: 'Quad.Out',
      });
    },
  });
  if (debugName) setDebugName(container, debugName);
  return container;
}

function createRelicOffer(scene, offer, {
  x,
  y,
  scale = 1,
  blocked = false,
  onClick = null,
  priceLabel = null,
  priceSubLabel = null,
  debugName = '',
}) {
  const container = scene.add.container(x, y).setScale(scale);
  const shadow = scene.add.ellipse(0, 106, 154, 17, 0x000000, 0.22);
  const glow = scene.add.circle(0, -12, 82, 0x4b8a67, 0.12).setAlpha(0.18);
  const plaque = createPanelGraphic(scene, {
    width: 178,
    height: 204,
    fill: 0x0e1810,    // dark forest stone (was: mint 0xe5f1ea)
    stroke: 0x2a4a36,
    radius: 28,
  });
  const ring = scene.add.circle(0, -10, 58, 0x4b8a67, 1)
    .setStrokeStyle(4, 0x183125, 0.92);
  const core = scene.add.circle(0, -10, 44, 0x162210, 1)  // dark forest core
    .setStrokeStyle(2, 0x3a6448, 0.40);
  const emblem = scene.add.text(0, -12, badgeGlyph(offer.name), {
    fontFamily: FONT_DISPLAY,
    fontSize: '31px',
    color: '#90e8b0',   // bright mint on dark (was '#183125')
    fontStyle: 'bold',
    stroke: '#060c08',
    strokeThickness: 1,
  }).setOrigin(0.5);
  const name = scene.add.text(0, 64, offer.name ?? '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '20px',
    color: '#7ad8a0',   // pale mint (was '#183125')
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const desc = scene.add.text(0, 86, offer.desc ?? '', {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: '#60a878',   // muted sage (was '#466250')
    wordWrap: { width: 144 },
    align: 'center',
    lineSpacing: 2,
  }).setOrigin(0.5, 0);
  fitSingleLineText(name, offer.name ?? '', {
    maxWidth: 142,
    minFontSize: 14,
    ellipsis: '...',
  });
  fitParagraphText(desc, offer.desc ?? '', {
    maxWidth: 144,
    maxHeight: 50,
    maxLines: 4,
    minFontSize: 10,
    ellipsis: '...',
  });
  const hit = scene.add.rectangle(0, 0, 178, 204, 0xffffff, 0.001);

  container.add([shadow, glow, plaque, ring, core, emblem, name, desc]);
  if (priceLabel) {
    container.add(createPriceTag(scene, {
      x: 54,
      y: -78,
      label: priceLabel,
      subLabel: priceSubLabel,
      tone: offer.freeEligible ? 'free' : 'gold',
    }));
  }
  if (offer.canAfford === false) {
    container.add(scene.add.rectangle(0, 0, 178, 204, 0x1d1713, 0.16));
  }
  container.add(hit);

  enableInteractiveLift(scene, {
    container,
    hit,
    baseEnabled: onClick != null && offer.canAfford !== false,
    blocked,
    onClick,
    hoverScale: 1.035,
    hoverLift: 8,
    onHoverChange: (active) => {
      scene.tweens.killTweensOf(glow);
      scene.tweens.add({
        targets: glow,
        alpha: active ? 0.36 : 0.18,
        duration: 120,
        ease: 'Quad.Out',
      });
    },
  });
  if (debugName) setDebugName(container, debugName);
  return container;
}

function createScreenEmblem(scene, {
  x,
  y,
  label,
  theme,
}) {
  const container = scene.add.container(x, y);
  const glow = scene.add.circle(0, 0, 80, theme.glowA, 0.12);
  const ring = scene.add.circle(0, 0, 62, theme.accent, 1)
    .setStrokeStyle(4, theme.frame, 0.92);
  const core = scene.add.circle(0, 0, 48, 0x18140e, 1);
  const text = scene.add.text(0, -2, label, {
    fontFamily: FONT_DISPLAY,
    fontSize: '38px',
    color: theme.text,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add([glow, ring, core, text]);
  return container;
}

function createScreenPanel(scene, {
  x,
  y,
  width,
  height,
  title,
  subtitle,
  theme,
  footerHeight = 0,
  debugName = '',
}) {
  const container = scene.add.container(x, y);
  const shadow = scene.add.rectangle(0, 8, width + 14, height + 12, 0x000000, 0.16);
  const panel = createPanelGraphic(scene, {
    width,
    height,
    fill: theme.panel,
    stroke: theme.frame,
    radius: 22,
  });
  const titleText = scene.add.text(-width / 2 + 28, -height / 2 + 26, title, {
    fontFamily: FONT_DISPLAY,
    fontSize: '24px',
    color: theme.text,
    fontStyle: 'bold',
  }).setOrigin(0, 0);
  fitSingleLineText(titleText, title, {
    maxWidth: width - 56,
    minFontSize: 18,
    ellipsis: '...',
  });
  container.add([shadow, panel, titleText]);

  let contentTop = -height / 2 + 74;
  if (subtitle) {
    const subtitleText = scene.add.text(-width / 2 + 28, -height / 2 + 56, subtitle, {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: theme.soft,
      wordWrap: { width: width - 56 },
      lineSpacing: 2,
    }).setOrigin(0, 0);
    fitParagraphText(subtitleText, subtitle, {
      maxWidth: width - 56,
      maxHeight: 48,
      maxLines: 3,
      minFontSize: 10,
      ellipsis: '...',
    });
    container.add(subtitleText);
    contentTop = -height / 2 + 96;
  }

  let footerTop = height / 2;
  let footerCenterY = height / 2 - 28;
  if (footerHeight > 0) {
    footerTop = height / 2 - footerHeight;
    footerCenterY = footerTop + footerHeight / 2;
    const footerBg = scene.add.rectangle(0, footerCenterY, width - 20, footerHeight - 18, theme.accentDark, 0.78)
      .setStrokeStyle(1, theme.frame, 0.32);
    const footerLine = scene.add.rectangle(0, footerTop, width - 34, 2, theme.frame, 0.34);
    container.add([footerBg, footerLine]);
  }

  if (debugName) setDebugName(container, debugName);
  return {
    container,
    width,
    height,
    contentTop,
    contentBottom: footerHeight > 0 ? footerTop - 24 : height / 2 - 28,
    footerTop,
    footerCenterY,
    footerHeight,
  };
}

function buildMessageScreen(screen, spec, blocked) {
  const { scene, root } = screen;
  const theme = flowTheme(spec.kind);
  const header = createHeader(scene, spec, theme);
  root.add(header);

  const panel = createScreenPanel(scene, {
    x: scene.W / 2,
    y: scene.H * 0.58,
    width: Math.min(scene.W - 160, 760),
    height: 410,
    title: spec.panelTitle,
    subtitle: spec.panelSubtitle,
    theme,
    footerHeight: 84,
    debugName: `flow.${spec.kind}.panel`,
  });
  root.add(panel.container);

  panel.container.add(createSceneHero(scene, {
    x: 0,
    y: panel.contentTop + 42,
    width: Math.min(panel.width - 88, 560),
    eyebrow: spec.heroEyebrow ?? '',
    title: spec.heroTitle ?? spec.panelTitle,
    summary: spec.heroSummary ?? '',
    emblem: spec.emblem,
    theme,
    debugName: `flow.${spec.kind}.hero`,
  }));

  if (spec.noticeText) {
    panel.container.add(createNoticeBanner(scene, {
      x: 0,
      y: panel.contentTop + 116,
      width: Math.min(panel.width - 96, 520),
      text: spec.noticeText,
      theme,
      debugName: `flow.${spec.kind}.notice`,
    }));
  }

  const actionButton = registerInteractiveNode(screen, `message:${spec.kind}:action`, createActionButton(scene, {
    x: 0,
    y: panel.footerCenterY,
    width: 220,
    label: spec.action.label,
    kind: spec.action.kind ?? 'primary',
    blocked,
    onClick: spec.action.onClick,
    debugName: `flow.${spec.kind}.action`,
  }));
  panel.container.add(actionButton);
}

function getPhaseControllerForViewState(viewState) {
  return PHASE_CONTROLLERS.find((controller) => controller.supportsViewState?.(viewState)) ?? null;
}

function getPhaseControllerForStep(step) {
  return PHASE_CONTROLLERS.find((controller) => controller.supportsStep?.(step)) ?? null;
}

function buildMessageSpec(viewState, callbacks) {
  if (!viewState) return null;
  const phase = viewState.phase ?? 'battle';

  if (phase === 'battle' && viewState.over) {
    if (!viewState.victory) {
      return {
        kind: 'defeat',
        title: '败北',
        subtitle: '这一战已经结束，流程会停在失败节点。',
        goldText: `金币 ${viewState.run?.gold ?? 0}`,
        panelTitle: '本次远征止步于此',
        panelSubtitle: '',
        heroEyebrow: '战斗结果',
        heroTitle: '你倒在了这场战斗里',
        heroSummary: '当前流程会停在失败结点，不再继续推进后续内容。你可以立刻重新开始，再次验证整套战斗回路。',
        noticeText: '失败界面目前只承担收束与重开职责，不再混入调试提示。',
        emblem: '败',
        action: {
          label: '重新开始',
          kind: 'danger',
          onClick: () => callbacks.onRestart?.(),
        },
      };
    }

    if (!viewState.rewardOffered) {
      return null;
    }

    const progress = viewState.run?.progress ?? null;
    const routeName = progress?.routeName ?? '本轮远征';
    const routeSummary = progress?.completed
      ? `${routeName}已经完整走通。`
      : `${routeName}已在当前节点收束。`;

    return {
      kind: 'journey',
      title: progress?.completed ? '远征完成' : '旅途暂歇',
      subtitle: routeSummary,
      goldText: `金币 ${viewState.run?.gold ?? 0}`,
      panelTitle: progress?.completed ? '这一轮流程已经完成' : '这一段流程已经结束',
      panelSubtitle: '',
      heroEyebrow: progress?.completed ? '流程闭环' : '流程节点',
      heroTitle: progress?.completed ? '你已经走完整条演示路线' : '当前流程在这里停驻',
      heroSummary: progress?.completed
        ? '战斗、奖励、商店与下一战的衔接已经串成一条完整链路。你可以重新开始，再测一遍不同组合。'
        : '当前流程会在这里停住，不再伪装成还有未实现的下一层。你可以重新开始，继续验证这条链路。'
      ,
      noticeText: progress?.completed
        ? '这里是一次完整远征的收束界面。'
        : '这里代表一个明确的流程终点，而不是临时弹窗。',
      emblem: '旅',
      action: {
        label: '重新开始',
        kind: 'primary',
        onClick: () => callbacks.onRestart?.(),
      },
    };
  }

  return null;
}

function resolveFlowSpec(viewState, callbacks) {
  if (!viewState) return { controller: null, spec: null };
  const controller = getPhaseControllerForViewState(viewState);
  if (controller) {
    return {
      controller,
      spec: controller.buildSpec(viewState, callbacks),
    };
  }
  return {
    controller: null,
    spec: buildMessageSpec(viewState, callbacks),
  };
}

function signatureForSpec(scene, controller, spec) {
  if (!spec) return 'hidden';
  if (controller?.signature) return controller.signature(scene, spec);

  return JSON.stringify({
    kind: spec.kind,
    width: scene.W,
    height: scene.H,
    goldText: spec.goldText,
    panelTitle: spec.panelTitle,
    panelSubtitle: spec.panelSubtitle,
    heroEyebrow: spec.heroEyebrow,
    heroTitle: spec.heroTitle,
    heroSummary: spec.heroSummary,
    noticeText: spec.noticeText,
  });
}

function drawBackdrop(scene, graphics, theme, kind = 'reward') {
  graphics.clear();
  graphics.fillStyle(theme.backdrop, 0.88);
  graphics.fillRect(0, 0, scene.W, scene.H);

  const glowRadius = Math.max(scene.W, scene.H) * 0.18;
  graphics.fillStyle(theme.glowA, 0.08);
  graphics.fillCircle(scene.W * 0.5, scene.H * 0.24, glowRadius);
  graphics.fillStyle(theme.glowB, 0.06);
  graphics.fillEllipse(scene.W * 0.5, scene.H * 0.82, scene.W * 0.42, scene.H * 0.12);
  graphics.lineStyle(1, theme.frame, 0.1);
  graphics.strokeRect(20, 20, scene.W - 40, scene.H - 40);

  if (kind === 'reward') {
    graphics.fillStyle(theme.accent, 0.035);
    for (let index = -3; index <= 3; index += 1) {
      const offset = index * 94;
      graphics.fillTriangle(
        scene.W * 0.5 + offset,
        0,
        scene.W * 0.5 + offset + 56,
        scene.H * 0.28,
        scene.W * 0.5 + offset - 56,
        scene.H * 0.28,
      );
    }
    graphics.lineStyle(2, theme.frame, 0.1);
    graphics.strokeEllipse(scene.W * 0.5, scene.H * 0.36, scene.W * 0.54, scene.H * 0.18);
  } else if (kind === 'shop' || kind === 'journey') {
    graphics.fillStyle(theme.glowA, 0.035);
    graphics.fillRoundedRect(scene.W * 0.12, scene.H * 0.2, scene.W * 0.2, scene.H * 0.42, 36);
    graphics.fillRoundedRect(scene.W * 0.68, scene.H * 0.2, scene.W * 0.2, scene.H * 0.42, 36);
    graphics.lineStyle(2, theme.frame, 0.1);
    graphics.beginPath();
    graphics.moveTo(scene.W * 0.2, scene.H * 0.74);
    graphics.lineTo(scene.W * 0.5, scene.H * 0.64);
    graphics.lineTo(scene.W * 0.8, scene.H * 0.74);
    graphics.strokePath();
  } else if (kind === 'defeat') {
    graphics.fillStyle(theme.glowA, 0.05);
    graphics.fillEllipse(scene.W * 0.5, scene.H * 0.78, scene.W * 0.58, scene.H * 0.16);
    graphics.lineStyle(2, theme.frame, 0.12);
    graphics.lineBetween(scene.W * 0.26, scene.H * 0.22, scene.W * 0.42, scene.H * 0.56);
    graphics.lineBetween(scene.W * 0.74, scene.H * 0.22, scene.W * 0.58, scene.H * 0.56);
    graphics.lineBetween(scene.W * 0.34, scene.H * 0.62, scene.W * 0.66, scene.H * 0.62);
  }
}

function hideFlowScreen(screen) {
  screen.signature = 'hidden';
  screen.blocked = false;
  screen.controller = null;
  screen.spec = null;
  screen.controllerView = null;
  screen.layoutWidth = null;
  screen.layoutHeight = null;
  screen.state.phase = FLOW_PHASES.hidden;
  screen.state.kind = null;
  screen.blocker.disableInteractive();
  screen.blocker.setVisible(false);
  screen.backdrop.clear();
  screen.backdrop.setVisible(false);
  screen.root.setVisible(false);
  screen.root.removeAll(true);
  resetOfferNodes(screen);
  resetInteractionNodes(screen);
  clearEffectRoot(screen);
}

function buildPhaseUiHelpers(screen) {
  return {
    FLOW_PHASES,
    fontUi: FONT_UI,
    flowTheme,
    syncHeader,
    clearOfferNodes,
    registerOfferNode,
    registerInteractiveNode,
    createHeader,
    createSectionLabel,
    createSceneHero,
    createNoticeBanner,
    createActionButton,
    createCardOffer,
    createGoldOffer,
    createRelicOffer,
    createScreenPanel,
    animateScreenIn,
    animateScreenOut,
    pulseOffer,
    showFlowToast,
    hideFlowScreen,
    updateInteractionState: (targetScreen, blocked) => updateInteractionState(targetScreen, blocked),
    syncScreen: (targetScreen, viewState, options) => syncFlowScreen(targetScreen, viewState, options),
    hasFlowSpec: (viewState) => !!resolveFlowSpec(viewState, screen.callbacks)?.spec,
  };
}

export function createFlowScreen(scene, callbacks = {}) {
  const blocker = setDebugName(
    scene.add.rectangle(scene.W / 2, scene.H / 2, scene.W, scene.H, 0x000000, 0.001)
      .setDepth(DEPTH.flowScreenBlocker)
      .setVisible(false)
      .setInteractive(),
    'flow.blocker',
  );
  blocker.on('pointerdown', (_pointer, _localX, _localY, event) => {
    event?.stopPropagation?.();
  });

  const backdrop = setDebugName(
    scene.add.graphics().setDepth(DEPTH.flowScreenBackdrop).setVisible(false),
    'flow.backdrop',
  );
  const root = setDebugName(
    scene.add.container(0, 0).setDepth(DEPTH.flowScreenContent).setVisible(false),
    'flow.root',
  );
  const effectRoot = setDebugName(
    scene.add.container(0, 0).setDepth(DEPTH.flowScreenContent + 4).setVisible(false),
    'flow.effects',
  );

  return {
    scene,
    callbacks,
    blocker,
    backdrop,
    root,
    effectRoot,
    signature: null,
    controller: null,
    spec: null,
    controllerView: null,
    layoutWidth: null,
    layoutHeight: null,
    offerNodes: new Map(),
    interactionNodes: new Map(),
    blocked: false,
    state: {
      phase: FLOW_PHASES.hidden,
      kind: null,
    },
  };
}

function shouldReleaseRetainedViewState(currentViewState, nextViewState) {
  const currentPhase = currentViewState?.phase ?? 'battle';
  const nextPhase = nextViewState?.phase ?? 'battle';
  return currentPhase !== nextPhase;
}

export function syncFlowScreen(screen, viewState, { blocked = false, force = false, hidden = false } = {}) {
  if (!screen) return;

  const { controller, spec } = resolveFlowSpec(viewState, screen.callbacks);
  const signature = signatureForSpec(screen.scene, controller, spec);
  if (!spec) {
    if (screen.signature !== 'hidden') hideFlowScreen(screen);
    return;
  }
  if (!force && screen.signature === signature) {
    updateInteractionState(screen, blocked);
    return;
  }

  if (
    !hidden
    && controller
    && screen.controller === controller
    && screen.state.kind === spec.kind
    && screen.layoutWidth === screen.scene.W
    && screen.layoutHeight === screen.scene.H
    && typeof controller.refresh === 'function'
  ) {
    const refreshed = controller.refresh(
      screen,
      spec,
      blocked,
      buildPhaseUiHelpers(screen),
      {
        previousSpec: screen.spec,
        view: screen.controllerView,
        force,
      },
    );
    if (refreshed) {
      screen.signature = signature;
      screen.spec = spec;
      screen.blocked = !!blocked;
      screen.state.phase = FLOW_PHASES.idle;
      updateInteractionState(screen, blocked);
      return;
    }
  }

  screen.signature = signature;
  screen.blocked = !!blocked;
  screen.controller = controller ?? null;
  screen.spec = spec;
  screen.layoutWidth = screen.scene.W;
  screen.layoutHeight = screen.scene.H;
  screen.state.kind = spec.kind;
  const theme = flowTheme(spec.kind);
  const { scene, blocker, backdrop, root } = screen;

  resetOfferNodes(screen);
  resetInteractionNodes(screen);
  clearEffectRoot(screen);
  blocker
    .setPosition(scene.W / 2, scene.H / 2)
    .setSize(scene.W, scene.H)
    .setVisible(true)
    .setInteractive();
  backdrop.setVisible(true);
  drawBackdrop(scene, backdrop, theme, spec.kind);
  root.setVisible(true);
  root.removeAll(true);

  if (controller) {
    screen.controllerView = controller.build(screen, spec, blocked, buildPhaseUiHelpers(screen)) ?? null;
  } else {
    buildMessageScreen(screen, spec, blocked);
    screen.controllerView = null;
  }

  updateInteractionState(screen, blocked);

  if (hidden) {
    screen.state.phase = FLOW_PHASES.prepared;
    prepareHiddenLayout(screen);
    return;
  }

  screen.state.phase = FLOW_PHASES.idle;
  restoreVisibleLayout(screen);
}

async function animateScreenIn(screen, animQueue, { quick = false } = {}) {
  if (!screen?.root || !screen?.backdrop) return;
  const { scene } = screen;
  const offerNodes = Array.from(screen.offerNodes.values());
  const rootDuration = quick ? 170 : 220;
  const stagger = quick ? 28 : 40;

  screen.state.phase = FLOW_PHASES.entering;
  screen.backdrop.setVisible(true);
  screen.root.setVisible(true);

  scene.tweens.add({
    targets: screen.backdrop,
    alpha: 1,
    duration: rootDuration,
    ease: 'Quad.Out',
  });
  scene.tweens.add({
    targets: screen.root,
    alpha: 1,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    duration: rootDuration,
    ease: 'Cubic.Out',
  });

  for (let index = 0; index < offerNodes.length; index += 1) {
    const node = offerNodes[index];
    scene.tweens.add({
      targets: node,
      alpha: 1,
      y: node.__flowBaseY ?? node.y ?? 0,
      duration: quick ? 150 : 180,
      delay: index * stagger,
      ease: 'Cubic.Out',
    });
  }

  await animQueue.wait(rootDuration + Math.max(0, offerNodes.length - 1) * stagger + 30);
  screen.state.phase = FLOW_PHASES.idle;
  restoreVisibleLayout(screen);
}

async function animateScreenOut(screen, animQueue) {
  if (!screen?.root?.visible || screen.signature === 'hidden') return;
  const { scene } = screen;
  screen.state.phase = FLOW_PHASES.exiting;
  clearEffectRoot(screen);

  scene.tweens.add({
    targets: screen.backdrop,
    alpha: 0,
    duration: 150,
    ease: 'Quad.Out',
  });
  scene.tweens.add({
    targets: screen.root,
    alpha: 0,
    y: -12,
    scaleX: 0.985,
    scaleY: 0.985,
    duration: 150,
    ease: 'Quad.Out',
  });
  await animQueue.wait(170);
}

async function pulseOffer(screen, key, animQueue, { consume = false } = {}) {
  const node = getOfferNode(screen, key);
  if (!node) {
    await animQueue.wait(90);
    return;
  }

  const baseY = node.__flowBaseY ?? node.y ?? 0;
  const baseScaleX = node.__flowBaseScaleX ?? node.scaleX ?? 1;
  const baseScaleY = node.__flowBaseScaleY ?? node.scaleY ?? 1;
  const { scene } = screen;

  scene.tweens.add({
    targets: node,
    y: baseY - 14,
    scaleX: baseScaleX * 1.06,
    scaleY: baseScaleY * 1.06,
    duration: 120,
    ease: 'Quad.Out',
  });
  await animQueue.wait(130);

  scene.tweens.add({
    targets: node,
    alpha: consume ? 0.18 : 1,
    y: consume ? baseY - 26 : baseY,
    scaleX: consume ? baseScaleX * 0.96 : baseScaleX,
    scaleY: consume ? baseScaleY * 0.96 : baseScaleY,
    duration: 170,
    ease: 'Cubic.Out',
  });
  await animQueue.wait(180);
}

async function pulseRoot(screen, animQueue) {
  if (!screen?.root?.visible) {
    await animQueue.wait(80);
    return;
  }

  const { scene } = screen;
  scene.tweens.add({
    targets: screen.root,
    scaleX: 1.01,
    scaleY: 1.01,
    duration: 90,
    ease: 'Quad.Out',
    yoyo: true,
  });
  await animQueue.wait(120);
}

async function showFlowToast(screen, text, {
  fill = 0x1a1208,
  stroke = 0x8a6a3d,
  color = '#fff4dd',
  y = 132,
} = {}, animQueue) {
  if (!screen?.effectRoot || !text) {
    await animQueue.wait(80);
    return;
  }

  const { scene, effectRoot } = screen;
  clearEffectRoot(screen);
  effectRoot.setVisible(true);

  const toast = scene.add.container(scene.W / 2, y + 12);
  const bg = scene.add.rectangle(0, 0, 280, 42, fill, 0.96)
    .setStrokeStyle(3, stroke, 0.9);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONT_UI,
    fontSize: '16px',
    color,
    fontStyle: 'bold',
    letterSpacing: 1,
  }).setOrigin(0.5);
  fitSingleLineText(label, text, {
    maxWidth: 248,
    minFontSize: 11,
    ellipsis: '...',
  });

  toast.add([bg, label]);
  toast.setAlpha(0);
  effectRoot.add(toast);

  scene.tweens.add({
    targets: toast,
    alpha: 1,
    y,
    duration: 160,
    ease: 'Quad.Out',
  });
  await animQueue.wait(260);
  scene.tweens.add({
    targets: toast,
    alpha: 0,
    y: y - 18,
    duration: 220,
    ease: 'Quad.In',
    onComplete: () => {
      toast.destroy();
      clearEffectRoot(screen);
    },
  });
  await animQueue.wait(230);
}

export async function playFlowStep(screen, step, {
  animQueue,
  currentViewState = null,
  nextViewState = null,
  blocked = true,
  releaseRetainedViewState = null,
} = {}) {
  if (!screen || !animQueue || !isFlowStep(step)) return false;

  const controller = getPhaseControllerForStep(step);
  let handled = false;
  if (controller) {
    handled = await controller.playStep(
      screen,
      step,
      {
        animQueue,
        currentViewState,
        nextViewState,
        blocked,
      },
      buildPhaseUiHelpers(screen),
    );
  } else {
    switch (step.kind) {
      case 'relic_acquire': {
        const relicId = step.data?.relicId ?? step.refs?.relicId ?? null;
        const relicName = nextViewState?.run?.relicEntries?.find((entry) => entry.id === relicId)?.name ?? relicId ?? '遗物';
        await pulseRoot(screen, animQueue);
        await showFlowToast(screen, `获得遗物：${relicName}`, {
          fill: 0x163a2a,
          stroke: 0x4b8a67,
          color: '#d6ffe8',
        }, animQueue);
        handled = true;
        break;
      }

      default:
        handled = false;
        break;
    }
  }

  if (handled && shouldReleaseRetainedViewState(currentViewState, nextViewState)) {
    releaseRetainedViewState?.();
  }

  return handled;
}

