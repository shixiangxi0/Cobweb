import { CARD_STATES } from '../state/battleCardState.js';
import { BATTLE_MODES } from '../state/battleModeState.js';
import {
  CARD_UI,
  COLORS,
  LAYOUT,
  TIMING,
} from '../../../src/constants.js';
import {
  createSkinnedCardBase,
  createSkinnedPileWidget,
  updateSkinnedCardBase,
} from './battleSkin.js';
import {
  fitParagraphText,
  fitSingleLineText,
} from './battleText.js';
import { createLayoutText } from '../../../ui/layout/index.js';
import { attachRectMask } from '../../../ui/layout/index.js';
import {
  CARD_FONT_STACKS,
  CARD_LAYOUT,
} from './battleCardLayout.js';
import { setDebugName } from '../support/battleDebug.js';
import { createStatusChipBar, syncStatusChipBar } from './battleStatusChips.js';
import {
  ACTOR_MOTION_STATES,
  ACTOR_TARGET_STATES,
  canSyncActorLayout,
  createActorNodeRuntime,
  setActorMotionState,
  setActorTargetState,
} from '../state/battleActorState.js';

const FONT_UI = CARD_FONT_STACKS.ui;
const FONT_DISPLAY = CARD_FONT_STACKS.display;
// Dungeon stone palette for enemy vitals
const ENEMY_HP = 0xcc3c1e;          // torch-red HP fill (molten stone)
const ENEMY_HP_BACK = 0x28160e;     // near-black stone well
const ENEMY_HP_LAG = 0x7a2810;      // dark ember lag bar
const ENEMY_NAME = '#e8d4a0';       // warm amber — readable on dark stone
const ENEMY_INTENT = '#b89a6e';     // warm stone inscription
const ACTOR_TARGET_VISUALS = {
  [ACTOR_TARGET_STATES.idle]: { glowAlpha: 0, ringAlpha: 0, scale: 1 },
  [ACTOR_TARGET_STATES.targetable]: { glowAlpha: 0.16, ringAlpha: 0.5, scale: 1.005 },
  [ACTOR_TARGET_STATES.hovered]: { glowAlpha: 0.32, ringAlpha: 0.92, scale: 1.03 },
};

function createHpBar(scene, {
  x,
  y,
  width,
  backColor,
  lagColor,
  frontColor,
  depth = 9,
}) {
  const hpBack = scene.add.rectangle(x, y, width, 14, backColor, 1).setOrigin(0, 0.5).setDepth(depth);
  const hpLag = scene.add.rectangle(x, y, width, 14, lagColor, 1).setOrigin(0, 0.5).setDepth(depth + 1);
  const hpFront = scene.add.rectangle(x, y, width, 14, frontColor, 1).setOrigin(0, 0.5).setDepth(depth + 2);
  return { hpBack, hpLag, hpFront };
}

export function createPileWidget(scene, { x, y, label, color, debugKey = null }) {
  return createSkinnedPileWidget(scene, {
    x,
    y,
    label,
    accentColor: color,
    debugKey,
  });
}

export function updatePileWidget(node, count) {
  if (!node?.count) return;
  const next = String(count ?? 0);
  const changed = node.lastCount !== null && node.lastCount !== next;
  node.count.setText(next);
  node.lastCount = next;

  if (!changed) return;

  node.container.scene.tweens.killTweensOf(node.container);
  node.container.scene.tweens.add({
    targets: node.container,
    scaleX: 1.06,
    scaleY: 1.06,
    duration: 120,
    ease: 'Quad.Out',
    yoyo: true,
  });
  node.container.scene.tweens.add({
    targets: node.glow,
    alpha: 0.24,
    duration: 120,
    ease: 'Quad.Out',
    yoyo: true,
  });
}

export function createActorNode(scene, {
  isPlayer,
  x,
  y,
  name,
  onPointerDown = null,
  onPointerOver = null,
  onPointerOut = null,
}) {
  if (isPlayer) {
    return createPlayerActorNode(scene, { x, y, name });
  }

  return createEnemyActorNode(scene, {
    x,
    y,
    name,
    onPointerDown,
    onPointerOver,
    onPointerOut,
  });
}

export function updateActorNode(scene, node, actor, displayMap) {
  fitSingleLineText(node.nameText, actor.name ?? '', {
    maxWidth: 140,
    minFontSize: node.isPlayer ? 10 : 12,
    ellipsis: '...',
  });

  const maxHp = Math.max(1, actor.maxHp ?? 1);
  const hp = Math.max(0, Math.min(actor.hp ?? 0, maxHp));
  const ratio = hp / maxHp;
  node.hpFront.setScale(ratio, 1);
  if (node.hpSubText) {
    node.hpText.setText(String(hp));
    node.hpSubText.setText(`/ ${maxHp}`);
  } else {
    node.hpText.setText(`${hp} / ${maxHp}`);
  }

  // 状态芯片条（敌人 + 玩家均有）
  if (node.statusChipBar) {
    const visualStatuses = {
      ...(actor.statuses ?? {}),
      ...((actor.block ?? 0) > 0 ? { block: { stacks: actor.block ?? 0 } } : {}),
    };
    syncStatusChipBar(scene, node.statusChipBar, visualStatuses, displayMap ?? {});
  }

  if (node.intentText) {
    fitParagraphText(node.intentText, actor.intent ?? '', {
      maxWidth: 148,
      maxHeight: 34,
      maxLines: 2,
      minFontSize: 11,
      ellipsis: '...',
    });
  }

  if (node.lastHp == null) {
    node.hpLag.setScale(ratio, 1);
  } else if (node.lastHp !== hp) {
    scene.tweens.add({
      targets: node.hpLag,
      scaleX: ratio,
      duration: 260,
      delay: 80,
      ease: 'Cubic.Out',
    });
  }
  node.lastHp = hp;
}

function ensureActorNodeRuntime(node) {
  if (!node) return null;
  node.runtime = createActorNodeRuntime({
    layoutX: node.runtime?.layoutX ?? node.baseX ?? node.container?.x ?? 0,
    layoutY: node.runtime?.layoutY ?? node.baseY ?? node.container?.y ?? 0,
    motionState: node.runtime?.motionState,
    targetState: node.runtime?.targetState,
  });
  return node.runtime;
}

export function syncActorNodePosition(scene, node, { x, y, immediate = false } = {}) {
  if (!scene || !node?.container?.active || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const runtime = ensureActorNodeRuntime(node);
  const prevLayoutX = runtime.layoutX;
  const prevLayoutY = runtime.layoutY;
  const layoutChanged = prevLayoutX !== x || prevLayoutY !== y;

  runtime.layoutX = x;
  runtime.layoutY = y;
  node.baseX = x;
  node.baseY = y;

  if (!canSyncActorLayout(runtime)) {
    return;
  }

  const closeEnough = Math.abs((node.container.x ?? 0) - x) < 0.5
    && Math.abs((node.container.y ?? 0) - y) < 0.5;
  if (!layoutChanged && closeEnough) {
    return;
  }

  scene.tweens.killTweensOf(node.container);
  if (immediate || !layoutChanged) {
    node.container.setPosition(x, y);
    setActorMotionState(runtime, ACTOR_MOTION_STATES.idle);
    return;
  }

  setActorMotionState(runtime, ACTOR_MOTION_STATES.relocating);
  scene.tweens.add({
    targets: node.container,
    x,
    y,
    duration: 180,
    ease: 'Cubic.Out',
    onComplete: () => {
      if (node.container?.active && runtime.motionState === ACTOR_MOTION_STATES.relocating) {
        setActorMotionState(runtime, ACTOR_MOTION_STATES.idle);
      }
    },
  });
}

export function beginActorNodeMotion(node, motionState = ACTOR_MOTION_STATES.animating) {
  if (!node?.container?.active) return null;
  const runtime = ensureActorNodeRuntime(node);
  node.container.scene?.tweens?.killTweensOf(node.container);
  setActorMotionState(runtime, motionState);
  return node;
}

export function endActorNodeMotion(scene, node, { immediate = false } = {}) {
  if (!scene || !node?.container?.active) return null;
  const runtime = ensureActorNodeRuntime(node);
  setActorMotionState(runtime, ACTOR_MOTION_STATES.idle);
  syncActorNodePosition(scene, node, {
    x: runtime.layoutX,
    y: runtime.layoutY,
    immediate,
  });
  return node;
}

export function setActorNodeTargetState(scene, node, targetState = ACTOR_TARGET_STATES.idle) {
  if (!scene || !node?.container?.active || node.isPlayer) return;

  const runtime = ensureActorNodeRuntime(node);
  const previousState = runtime.targetState;
  setActorTargetState(runtime, targetState);
  if (runtime.targetState === previousState) return;

  const visual = ACTOR_TARGET_VISUALS[runtime.targetState] ?? ACTOR_TARGET_VISUALS[ACTOR_TARGET_STATES.idle];
  node.container.setScale(visual.scale);

  if (node.targetGlow?.active) {
    scene.tweens.killTweensOf(node.targetGlow);
    scene.tweens.add({
      targets: node.targetGlow,
      alpha: visual.glowAlpha,
      duration: 90,
      ease: 'Quad.Out',
    });
  }

  if (node.ring?.active) {
    scene.tweens.killTweensOf(node.ring);
    scene.tweens.add({
      targets: node.ring,
      alpha: visual.ringAlpha,
      duration: 90,
      ease: 'Quad.Out',
    });
  }
}

export function assignActorNodeDebugNames(node, prefix) {
  if (!node || !prefix) return node;
  setDebugName(node.container, `${prefix}.container`);
  setDebugName(node.ring, `${prefix}.ring`);
  setDebugName(node.targetGlow, `${prefix}.targetGlow`);
  setDebugName(node.avatarLayer, `${prefix}.avatarLayer`);
  setDebugName(node.nameText, `${prefix}.nameText`);
  setDebugName(node.hpLag, `${prefix}.hpLag`);
  setDebugName(node.hpFront, `${prefix}.hpFront`);
  setDebugName(node.hpText, `${prefix}.hpText`);
  setDebugName(node.hpLabel, `${prefix}.label`);
  setDebugName(node.blockChip, `${prefix}.blockChip`);
  setDebugName(node.blockText, `${prefix}.blockText`);
  setDebugName(node.statusChipBar?.container, `${prefix}.statusChipBar`);
  setDebugName(node.intentText, `${prefix}.intentText`);
  return node;
}

function createPlayerActorNode(scene, { x, y, name }) {
  const container = scene.add.container(x, y).setDepth(88);
  const pedestalShadow = scene.add.ellipse(0, 56, 144, 24, COLORS.shadow, 0.18);
  const bodyBack = scene.add.ellipse(0, 2, 112, 100, 0x2d6c4d, 1)
    .setStrokeStyle(3, COLORS.outlineStrong, 0.84);
  const bodyFront = scene.add.ellipse(0, -8, 88, 80, 0x7dd69a, 1)
    .setStrokeStyle(2, COLORS.outlineStrong, 0.3);
  const crest = scene.add.star(0, -34, 5, 8, 14, 0xffd36a, 1)
    .setStrokeStyle(2, COLORS.outlineStrong, 0.72);

  // Dark stone HP plate — matches dungeon environment
  const hpPanel = scene.add.rectangle(0, 42, 164, 58, 0x1a1210, 0.96)
    .setStrokeStyle(3, 0x5c3a28, 0.72);
  // Torch-light top edge bevel
  const hpPanelEdge = scene.add.rectangle(0, 13, 158, 2, 0x7a5038, 0.42);

  const hpLabel = scene.add.text(0, 16, name || '', {
    fontFamily: FONT_UI,
    fontSize: '11px',
    color: '#88c8a0',    // muted green — matches player body tone
    fontStyle: 'bold',
    letterSpacing: 2,
  }).setOrigin(0.5).setDepth(11).setAlpha(0.96);

  const {
    hpBack,
    hpLag,
    hpFront,
  } = createHpBar(scene, {
    x: -72,
    y: 28,
    width: 144,
    backColor: ENEMY_HP_BACK,   // reuse dungeon stone well
    lagColor:  ENEMY_HP_LAG,    // ember lag
    frontColor: 0x3a9c68,       // player-green HP fill
    depth: 11,
  });

  hpBack.height = 10;
  hpLag.height = 10;
  hpFront.height = 10;

  const hpText = scene.add.text(0, 50, '0 / 0', {
    fontFamily: FONT_DISPLAY,
    fontSize: '22px',
    color: '#e0d0a8',   // warm amber — readable on dark stone
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(12);

  // 状态芯片条：竖向排列在血量面板右侧（与 HP 条垂直对齐）
  const statusChipBar = createStatusChipBar(scene, {
    x: 98,
    y: 28,
    maxChips: 5,
    layout: 'vertical',
    depth: 14,
  });

  container.add([
    pedestalShadow,
    bodyBack,
    bodyFront,
    crest,
    hpPanel,
    hpPanelEdge,
    hpLabel,
    hpBack,
    hpLag,
    hpFront,
    hpText,
    statusChipBar.container,
  ]);

  return {
    container,
    ring: null,
    targetGlow: null,
    nameText: hpLabel,
    hpLag,
    hpFront,
    hpText,
    hpSubText: null,
    hpLabel,
    blockText: null,
    blockChip: null,
    statusChipBar,
    intentText: null,
    baseX: x,
    baseY: y,
    lastHp: null,
    runtime: createActorNodeRuntime({ layoutX: x, layoutY: y }),
    isPlayer: true,
  };
}

function createEnemyActorNode(scene, {
  x,
  y,
  name,
  onPointerDown = null,
  onPointerOver = null,
  onPointerOut = null,
}) {
  const container = scene.add.container(x, y).setDepth(94);

  // Ground shadow — at character feet
  const floorShadow = scene.add.ellipse(0, 50, 148, 24, COLORS.shadow, 0.24);

  // Target highlight ring + glow (around the character silhouette)
  const targetGlow = scene.add.ellipse(0, -14, 168, 192, COLORS.targetGlow, 1)
    .setAlpha(0);
  const targetRing = scene.add.ellipse(0, -14, 168, 192, 0xffffff, 0)
    .setStrokeStyle(3, 0xffc060, 0.88)
    .setAlpha(0);

  // ── Name label — sits just above the HP strip (below animation body) ────
  const nameBand = scene.add.rectangle(0, 35, 152, 22, 0x0a0704, 0.76)
    .setStrokeStyle(1, 0x5c3220, 0.55);
  const nameText = createLayoutText(scene, name, {
    style: {
      fontFamily: FONT_DISPLAY,
      fontSize: '14px',
      color: ENEMY_NAME,
      fontStyle: 'bold',
      stroke: '#050302',
      strokeThickness: 1,
    },
    constraints: { maxWidth: 144, minFontSize: 10, ellipsis: '...' },
    mode: 'single',
  }).setPosition(0, 35).setOrigin(0.5).setDepth(141);

  // ── Intent label — sits below the HP strip ─────────────────────────────
  // Placed under feet so it never overlaps the animated sprite
  const intentBand = scene.add.rectangle(0, 106, 162, 22, 0x070504, 0.82)
    .setStrokeStyle(1, 0x3a1e0a, 0.55);
  const intentText = createLayoutText(scene, '', {
    style: {
      fontFamily: FONT_UI,
      fontSize: '15px',
      color: ENEMY_INTENT,
      align: 'center',
      stroke: '#040302',
      strokeThickness: 1,
      wordWrap: { width: 152 },
    },
    constraints: { maxWidth: 152, maxHeight: 36, maxLines: 2, minFontSize: 11, ellipsis: '...' },
    mode: 'multi',
  }).setPosition(0, 106).setOrigin(0.5).setDepth(141);

  // ── DragonBones avatar layer ────────────────────────────────────────────
  const avatarLayer = scene.add.container(0, -10);
  const avatarFallback = scene.add.container(0, -6);
  const avatarFallbackShadow = scene.add.ellipse(0, 32, 112, 18, 0x060402, 0.32);
  const avatarFallbackBack = scene.add.ellipse(0, -10, 96, 108, 0x1b1511, 0.94)
    .setStrokeStyle(2, 0x6b4a30, 0.4);
  const avatarFallbackCore = scene.add.ellipse(0, -18, 72, 86, 0x35261d, 0.92)
    .setStrokeStyle(2, 0x9a6d3a, 0.24);
  const avatarFallbackCrest = scene.add.triangle(0, -62, 0, -16, 14, 10, -14, 10, 0xc08a4c, 0.92);
  const avatarFallbackEyes = scene.add.rectangle(0, -22, 28, 4, 0xe8b86a, 0.9);
  avatarFallback.add([
    avatarFallbackShadow,
    avatarFallbackBack,
    avatarFallbackCore,
    avatarFallbackCrest,
    avatarFallbackEyes,
  ]);
  avatarLayer.add(avatarFallback);

  // ── HP strip — hugs the character's feet, grounded into the floor ───────
  // Outer stone rail
  const hpRail = scene.add.rectangle(0, 62, 148, 12, 0x0c0806, 1)
    .setOrigin(0.5, 0.5).setStrokeStyle(1, 0x3a2010, 0.55);

  const {
    hpBack,
    hpLag,
    hpFront,
  } = createHpBar(scene, {
    x: -72,
    y: 62,
    width: 144,
    backColor: ENEMY_HP_BACK,
    lagColor:  ENEMY_HP_LAG,
    frontColor: ENEMY_HP,
    depth: 11,
  });
  hpBack.height = 10;
  hpLag.height = 10;
  hpFront.height = 10;

  const hpText = scene.add.text(0, 75, '0 / 0', {
    fontFamily: FONT_UI,
    fontSize: '13px',
    color: '#c09a6e',
    fontStyle: 'bold',
    letterSpacing: 1,
  }).setOrigin(0.5).setDepth(12);

  // 状态芯片条：横向排列在意图文字下方（意图带底部 y≈117，此处留 26px 空隙）
  const statusChipBar = createStatusChipBar(scene, {
    x: 0,
    y: 143,
    maxChips: 6,
    layout: 'horizontal',
    depth: 14,
  });

  container.add([
    floorShadow,
    targetGlow,
    targetRing,
    intentBand,
    nameBand,
    avatarLayer,
    intentText,
    nameText,
    hpRail,
    hpBack,
    hpLag,
    hpFront,
    hpText,
    statusChipBar.container,
  ]);

  container.setSize(180, 270).setInteractive({ useHandCursor: true });
  if (onPointerDown) container.on('pointerdown', onPointerDown);
  if (onPointerOver) container.on('pointerover', onPointerOver);
  if (onPointerOut) container.on('pointerout', onPointerOut);

  return {
    container,
    ring: targetRing,
    targetGlow,
    avatarLayer,
    avatarFallback,
    avatarDisplay: null,
    avatarSkinKey: null,
    nameText,
    hpLag,
    hpFront,
    hpText,
    hpSubText: null,
    blockText: null,
    blockChip: null,
    statusChipBar,
    intentText,
    baseX: x,
    baseY: y,
    lastHp: null,
    hovered: false,
    runtime: createActorNodeRuntime({ layoutX: x, layoutY: y }),
    isPlayer: false,
  };
}

// Card text layout aligned to warm STS-style texture (name-top, art-mid, desc-bottom):
//   Header y  4-54  (164×224 texture) →  container y -108 to -58
//     cost gem : texture (26,27) → container (-56, -85)
//     card name: container (12, -86)   – right of gem, mid-header
//     tags line: container (12, -72)   – small subtitle in header
//   Art area: y 58-156 → container -54 to +44  (no text)
//   Desc area: y 160-220 → container +48 to +108
//     desc text starts at container +50
function createPaperPanel(scene, {
  x,
  y,
  width,
  height,
  fill = 0xf5f0e6,
  stroke = 0x3d3d3d,
  alpha = 0.9,
  radius = 5,
  cornerDots = false,
}) {
  const container = scene.add.container(x, y);
  const shadow = scene.add.rectangle(0, 1, width, height, 0x000000, 0.08);
  const bg = scene.add.rectangle(0, 0, width, height, fill, alpha)
    .setStrokeStyle(1.5, stroke, 0.52);
  const topRule = scene.add.rectangle(0, -height / 2 + 4, width - 12, 1, stroke, 0.16);
  container.add([shadow, bg, topRule]);

  if (cornerDots) {
    const dotColor = 0x8b0000;
    const offsetX = width / 2 - 8;
    const offsetY = height / 2 - 6;
    container.add([
      scene.add.circle(-offsetX, -offsetY, 1.5, dotColor, 0.42),
      scene.add.circle(offsetX, -offsetY, 1.5, dotColor, 0.42),
      scene.add.circle(-offsetX, offsetY, 1.5, dotColor, 0.42),
      scene.add.circle(offsetX, offsetY, 1.5, dotColor, 0.42),
    ]);
  }

  bg.setDisplaySize(width, height);
  shadow.setDisplaySize(width, height);
  shadow.setData?.('radius', radius);
  bg.setData?.('radius', radius);
  return { container, shadow, bg, topRule };
}

function createInkSeal(scene, x, y) {
  const container = scene.add.container(x, y);
  const outer = scene.add.circle(0, 0, 16, 0x111111, 0.9);
  const inner = scene.add.circle(0, 0, 11.5, 0xf8f4eb, 0.98)
    .setStrokeStyle(1, 0x111111, 0.36);
  const dot = scene.add.circle(8, 8, 2, 0x8b0000, 0.34);
  container.add([outer, inner, dot]);
  return container;
}

export function createCardNode(scene, card, {
  x,
  y,
  onPointerOver = null,
  onPointerOut = null,
  onPointerDown = null,
}) {
  const size = CARD_LAYOUT.size;
  const header = CARD_LAYOUT.header;
  const description = CARD_LAYOUT.description;
  const H2 = size.h / 2;         // 112
  const W2 = size.w / 2;         // 82
  const container = scene.add.container(x, y).setDepth(110);
  container.setSize(size.w, size.h).setInteractive({ useHandCursor: true });

  const skin = createSkinnedCardBase(scene, { type: card.display?.type });
  const shadow = scene.add.ellipse(0, H2 + 8, size.w * 0.78, 16, COLORS.shadow, 0.40);
  const glow = skin.glow;
  const outer = scene.add.rectangle(0, 0, size.w, size.h, 0xffffff, 0.01)
    .setStrokeStyle(2, COLORS.frameSoft, 0);
  const seal = createInkSeal(scene, -W2 + 26, -H2 + 27);
  const namePlate = createPaperPanel(scene, {
    x: header.panel.x,
    y: header.panel.y,
    width: header.panel.width,
    height: header.panel.height,
    fill: 0xf5f0e6,
    stroke: 0x3d3d3d,
    alpha: 0.9,
  });
  const descPlate = createPaperPanel(scene, {
    x: description.panel.x,
    y: description.panel.y,
    width: description.panel.width,
    height: description.panel.height,
    fill: 0xf5f0e6,
    stroke: 0x3d3d3d,
    alpha: 0.86,
    cornerDots: true,
  });

  // Cost gem  — in-header, left side
  const costText = scene.add.text(header.cost.x, header.cost.y, String(card.cost), {
    fontFamily: FONT_DISPLAY,
    fontSize: '18px',
    color: '#111111',
    fontStyle: 'bold',
    stroke: '#f8f4eb',
    strokeThickness: 1,
  }).setOrigin(0.5);

  seal.setPosition(header.seal.x, header.seal.y);

  const title = scene.add.text(header.title.x, header.title.y, card.display?.name ?? card.cardId ?? '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '16px',
    color: '#111111',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  // Description — in dark carved inscription zone, light text on dark stone.
  // Desc area: container y +54 to +108 = 54px usable.
  // 13px font + lineSpacing 2 ≈ 15px/line → 3-4 lines. trim to 38 chars.
  const desc = scene.add.text(description.text.x, description.text.y, card.display?.desc ?? '', {
    fontFamily: FONT_UI,
    fontSize: '14px',
    color: '#111111',
    stroke: '#ffffff',
    strokeThickness: 0.2,
    wordWrap: { width: description.text.maxWidth, useAdvancedWrap: true },
    align: 'center',
    lineSpacing: 4,
  }).setOrigin(0.5, 0);

  fitSingleLineText(title, card.display?.name ?? card.cardId ?? '', {
    maxWidth: header.title.maxWidth,
    minFontSize: header.title.minFontSize,
    ellipsis: '...',
  });
  fitParagraphText(desc, card.display?.desc ?? '', {
    maxWidth: description.text.maxWidth,
    maxHeight: description.text.maxHeight,
    maxLines: description.text.maxLines,
    minFontSize: description.text.minFontSize,
    ellipsis: '...',
  });

  container.add([
    shadow,
    glow,
    skin.body,
    outer,
    namePlate.container,
    descPlate.container,
    seal,
    costText,
    title,
    desc,
  ]);

  if (onPointerOver) container.on('pointerover', onPointerOver);
  if (onPointerOut) container.on('pointerout', onPointerOut);
  if (onPointerDown) container.on('pointerdown', onPointerDown);

  return {
    card,
    container,
    shadow,
    glow,
    body: skin.body,
    outer,
    seal,
    namePlate,
    descPlate,
    title,
    desc,
    costText,
    baseX: container.x,
    baseY: container.y,
    baseRotation: 0,
    uiState: CARD_STATES.idle,
  };
}

export function updateCardNode(node, card) {
  node.card = card;
  updateSkinnedCardBase(node, card.display?.type);
  const header = CARD_LAYOUT.header;
  const description = CARD_LAYOUT.description;
  fitSingleLineText(node.title, card.display?.name ?? card.cardId ?? '', {
    maxWidth: header.title.maxWidth,
    minFontSize: header.title.minFontSize,
    ellipsis: '...',
  });
  fitParagraphText(node.desc, card.display?.desc ?? '', {
    maxWidth: description.text.maxWidth,
    maxHeight: description.text.maxHeight,
    maxLines: description.text.maxLines,
    minFontSize: description.text.minFontSize,
    ellipsis: '...',
  });
  node.costText.setText(String(card.cost));
}

export function assignCardNodeDebugNames(node, prefix) {
  if (!node || !prefix) return node;
  setDebugName(node.container, `${prefix}.container`);
  setDebugName(node.shadow, `${prefix}.shadow`);
  setDebugName(node.glow, `${prefix}.glow`);
  setDebugName(node.body, `${prefix}.body`);
  setDebugName(node.outer, `${prefix}.outer`);
  setDebugName(node.seal, `${prefix}.seal`);
  setDebugName(node.namePlate?.container, `${prefix}.namePlate`);
  setDebugName(node.descPlate?.container, `${prefix}.descPlate`);
  setDebugName(node.title, `${prefix}.title`);
  setDebugName(node.desc, `${prefix}.desc`);
  setDebugName(node.costText, `${prefix}.cost`);
  return node;
}

export function settleCard(scene, node, mode) {
  if (!node?.container?.active) return;
  const state = node.uiState === CARD_STATES.hover && mode === BATTLE_MODES.idle
    ? CARD_STATES.hover
    : node.uiState === CARD_STATES.targeting
      ? CARD_STATES.targeting
      : CARD_STATES.idle;
  transitionCardNode(scene, node, cardPoseForState(node, state), {
    duration: TIMING.settle,
    ease: 'Cubic.Out',
  });
}

export function cardPoseForState(node, state = CARD_STATES.idle) {
  const baseRotation = node.baseRotation ?? 0;
  const pose = {
    x: node.baseX,
    y: node.baseY,
    rotation: baseRotation,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    glowAlpha: 0,
    shadowAlpha: CARD_UI.motion.shadowIdleAlpha,
  };

  if (state === CARD_STATES.hover) {
    pose.y -= CARD_UI.hover.lift;
    pose.rotation = CARD_UI.hover.normalizeRotation ? 0 : baseRotation;
    pose.scaleX = CARD_UI.hover.scale;
    pose.scaleY = CARD_UI.hover.scale;
    pose.glowAlpha = CARD_UI.motion.hoverGlow;
    pose.shadowAlpha = CARD_UI.motion.shadowHoverAlpha;
  } else if (state === CARD_STATES.targeting) {
    pose.y -= CARD_UI.targeting.lift;
    pose.rotation = CARD_UI.targeting.normalizeRotation ? 0 : baseRotation;
    pose.scaleX = CARD_UI.targeting.scale;
    pose.scaleY = CARD_UI.targeting.scale;
    pose.glowAlpha = CARD_UI.motion.selectedGlow;
    pose.shadowAlpha = CARD_UI.motion.shadowHoverAlpha;
  }

  return pose;
}

export function transitionCardNode(scene, node, pose, {
  duration = TIMING.settle,
  ease = 'Cubic.Out',
  immediate = false,
} = {}) {
  if (!node?.container?.active || !pose) return;

  scene.tweens.killTweensOf(node.container);
  scene.tweens.killTweensOf(node.glow);
  if (node.shadow) scene.tweens.killTweensOf(node.shadow);

  if (immediate) {
    node.container.setPosition(pose.x, pose.y);
    node.container.setRotation(pose.rotation);
    node.container.setScale(pose.scaleX, pose.scaleY);
    node.container.setAlpha(pose.alpha);
    node.glow.setAlpha(pose.glowAlpha ?? 0);
    node.shadow?.setAlpha(pose.shadowAlpha ?? CARD_UI.motion.shadowIdleAlpha);
    return;
  }

  scene.tweens.add({
    targets: node.container,
    x: pose.x,
    y: pose.y,
    rotation: pose.rotation,
    scaleX: pose.scaleX,
    scaleY: pose.scaleY,
    alpha: pose.alpha,
    duration,
    ease,
  });
  scene.tweens.add({
    targets: node.glow,
    alpha: pose.glowAlpha ?? 0,
    duration: Math.min(duration, TIMING.hover),
    ease: 'Quad.Out',
  });
  if (node.shadow) {
    scene.tweens.add({
      targets: node.shadow,
      alpha: pose.shadowAlpha ?? CARD_UI.motion.shadowIdleAlpha,
      duration: Math.min(duration, TIMING.hover),
      ease: 'Quad.Out',
    });
  }
}

