import { COLORS } from '../../../src/constants.js';
import { BATTLE_MODES } from '../state/battleModeState.js';
import { refreshEndTurnButton } from './battleHud.js';
import {
  createSkinnedEndTurnButton,
  createSkinnedTurnPlate,
} from './battleSkin.js';
import {
  createRelicBar,
  relayoutRelicBar,
} from './battleRelics.js';
import { applyModeToHud } from '../state/battleUiState.js';
import { createPileWidget } from './battleViews.js';
import {
  preloadStatusChipTextures,
  createStatusChipTooltip,
} from './battleStatusChips.js';
import { createCardTooltip } from './battleCardTooltip.js';
import { enhanceTextQuality } from '../../../ui/layout/layoutText.js';

const FONT_DISPLAY = '"Georgia", "Times New Roman", serif';
const FONT_UI = '"Trebuchet MS", "Verdana", sans-serif';

// Background is drawn procedurally — no image assets needed.
export function preloadBattleEnvironment(scene) {
  preloadStatusChipTextures(scene);
}

export function createBattleEnvironment(scene, options) {
  const ui = {};

  // 创建场景级状态工具提示（全局共享，芯片悬浮时读取）
  const statusChipTooltip = createStatusChipTooltip(scene);
  ui.statusChipTooltip = statusChipTooltip;
  scene._battleStatusChipTooltip = statusChipTooltip;

  // 手牌悬浮详情提示
  ui.cardTooltip = createCardTooltip(scene);

  buildBackground(scene, ui);
  buildBottomPanel(scene, ui);
  buildHud(scene, ui, options);
  buildStage(scene, ui, options);
  buildHandShelf(scene, ui);
  buildOverlay(scene, ui);

  return ui;
}

export function relayoutBattleEnvironment(scene, ui) {
  if (!scene || !ui) return;
  relayoutBackground(scene, ui);
  relayoutBottomPanel(scene, ui);
  relayoutHud(scene, ui);
  relayoutStage(scene, ui);
  relayoutHandShelf(scene, ui);
  relayoutOverlay(scene, ui);
}

function resizeRect(node, width, height) {
  if (!node) return;
  node.setSize?.(width, height);
  node.setDisplaySize?.(width, height);
}

function relayoutDropZone(zone, { x, y, width, height }) {
  if (!zone?.container) return;
  zone.container.setPosition(x, y);
  resizeRect(zone.fill, width, height);
  resizeRect(zone.frame, width, height);
  resizeRect(zone.inner, Math.max(0, width - 10), Math.max(0, height - 10));
  zone.label?.setPosition(0, -height / 2 - 12);
}

// ── Procedural dungeon arena background ─────────────────────────────────────
//
// Layer structure (depth 0–1):
//   depth 0  dungeonBase   — stone walls, arch columns, floor tiles, torch glow
//   depth 1  dungeonFx     — vignette overlay and edge frame
//
// Color palette stays within the warm ink-wash tones used by cards and flow
// screens so all screens feel like one game instead of three separate web pages.

function drawDungeonBase(g, W, H) {
  g.clear();

  // ── Ceiling / upper void ────────────────────────────────────────────
  g.fillGradientStyle(0x0f0a07, 0x0f0a07, 0x1c1410, 0x1c1410, 1);
  g.fillRect(0, 0, W, H * 0.55);

  // ── Back wall fill ──────────────────────────────────────────────────
  const wallL = Math.round(W * 0.07);
  const wallR = Math.round(W * 0.93);
  const wallT = Math.round(H * 0.05);
  const wallB = Math.round(H * 0.60);
  g.fillStyle(0x241a10, 1);
  g.fillRect(wallL, wallT, wallR - wallL, wallB - wallT);

  // Stone block grid on back wall
  const bh = Math.max(16, Math.round((wallB - wallT) / 10));
  const bw = Math.round(bh * 2.2);
  g.lineStyle(1.5, 0x130d08, 0.72);
  for (let row = 0; row <= Math.ceil((wallB - wallT) / bh); row += 1) {
    const by = wallT + row * bh;
    g.lineBetween(wallL, by, wallR, by);
    for (let col = 0; col < 60; col += 1) {
      const ox = row % 2 === 0 ? 0 : bw * 0.5;
      const bx = wallL + col * bw + ox;
      if (bx < wallL || bx > wallR) continue;
      g.lineBetween(bx, by, bx, Math.min(by + bh, wallB));
    }
  }
  // Mortar highlight (top of each course)
  g.lineStyle(1, 0x3e2c1e, 0.28);
  for (let row = 1; row <= Math.ceil((wallB - wallT) / bh); row += 1) {
    const by = wallT + row * bh + 1;
    if (by >= wallB) break;
    g.lineBetween(wallL + 3, by, wallR - 3, by);
  }

  // ── Side arch columns ───────────────────────────────────────────────
  const colW = Math.max(32, Math.round(W * 0.055));
  const colT = Math.round(H * 0.03);
  const colB = Math.round(H * 0.75);
  // Left column
  g.fillStyle(0x18100a, 1);
  g.fillRect(0, colT, colW + 14, colB - colT);
  g.fillStyle(0x261a10, 1);
  g.fillRect(8, colT, colW, colB - colT);
  g.fillStyle(0x3a2618, 1);
  g.fillRect(12, colT, 5, colB - colT);
  // Right column
  g.fillStyle(0x18100a, 1);
  g.fillRect(W - colW - 14, colT, colW + 14, colB - colT);
  g.fillStyle(0x261a10, 1);
  g.fillRect(W - colW - 8, colT, colW, colB - colT);
  g.fillStyle(0x3a2618, 1);
  g.fillRect(W - 17, colT, 5, colB - colT);
  // Column face highlights
  g.lineStyle(1, 0x4e3828, 0.45);
  g.lineBetween(10, colT, 10, colB);
  g.lineBetween(W - 10, colT, W - 10, colB);

  // ── Floor tiles (continuous from stage into bottom panel) ───────────
  const floorT = Math.round(H * 0.56);
  const tw = Math.max(44, Math.round(W / 22));
  const th = Math.round(tw * 0.46);
  g.fillGradientStyle(0x1a1410, 0x1a1410, 0x110d09, 0x110d09, 1);
  g.fillRect(0, floorT, W, H - floorT);
  g.lineStyle(1, 0x0c0806, 0.60);
  for (let row = 0; row < 18; row += 1) {
    const fy = floorT + row * th;
    if (fy > H) break;
    g.lineBetween(0, fy, W, fy);
    for (let col = 0; col < Math.ceil(W / tw) + 2; col += 1) {
      const ox = row % 2 === 0 ? 0 : tw * 0.5;
      const fx = col * tw + ox - tw * 0.5;
      g.lineBetween(fx, fy, fx, Math.min(fy + th, H));
    }
  }
  // Floor edge darkening towards sides
  g.fillGradientStyle(0x0e0a06, 0x0e0a06, 0x0e0a06, 0x0e0a06, 0.38);
  g.fillRect(0, floorT, W * 0.22, H - floorT);
  g.fillGradientStyle(0x0e0a06, 0x0e0a06, 0x0e0a06, 0x0e0a06, 0.38);
  g.fillRect(W * 0.78, floorT, W * 0.22, H - floorT);

  // ── Torch glow (upper corners behind columns) ────────────────────────
  const tr = Math.round(Math.min(W, H) * 0.40);
  const torchY = Math.round(H * 0.20);
  g.fillStyle(0xcc8830, 0.11);
  g.fillCircle(Math.round(W * 0.10), torchY, tr);
  g.fillStyle(0xe0a040, 0.07);
  g.fillCircle(Math.round(W * 0.10), torchY, Math.round(tr * 0.55));
  g.fillStyle(0xcc8830, 0.11);
  g.fillCircle(Math.round(W * 0.90), torchY, tr);
  g.fillStyle(0xe0a040, 0.07);
  g.fillCircle(Math.round(W * 0.90), torchY, Math.round(tr * 0.55));

  // Stage center atmospheric warm haze
  g.fillStyle(0xb07028, 0.06);
  g.fillEllipse(Math.round(W * 0.5), Math.round(H * 0.42), Math.round(W * 0.5), Math.round(H * 0.32));
}

function drawDungeonFx(g, W, H) {
  g.clear();
  // Top vignette
  g.fillGradientStyle(0x080604, 0x080604, 0x080604, 0x080604, 0.88);
  g.fillRect(0, 0, W, Math.round(H * 0.055));
  // Side edge gradient (left)
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle(0x060402, 0.20 - i * 0.03);
    g.fillRect(0, 0, Math.round(W * (0.04 - i * 0.006)), H);
  }
  // Side edge gradient (right)
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle(0x060402, 0.20 - i * 0.03);
    g.fillRect(Math.round(W * (0.96 + i * 0.006)), 0, Math.round(W * 0.04), H);
  }
  // Outer frame line
  g.lineStyle(1, 0x3a2c1e, 0.16);
  g.strokeRect(3, 3, W - 6, H - 6);
}

function buildBackground(scene, ui) {
  ui.dungeonBase = scene.add.graphics().setDepth(0);
  ui.dungeonFx = scene.add.graphics().setDepth(1);

  ui.bgHitArea = scene.add
    .rectangle(scene.W / 2, scene.H / 2, scene.W, scene.H, 0x000000, 0.001)
    .setDepth(10)
    .setInteractive();

  relayoutBackground(scene, ui);
}

function relayoutBackground(scene, ui) {
  const W = scene.W;
  const H = scene.H;

  if (ui.dungeonBase?.active) drawDungeonBase(ui.dungeonBase, W, H);
  if (ui.dungeonFx?.active) drawDungeonFx(ui.dungeonFx, W, H);

  if (ui.bgHitArea?.active) {
    ui.bgHitArea.setPosition(W / 2, H / 2);
    resizeRect(ui.bgHitArea, W, H);
    ui.bgHitArea.removeInteractive();
    ui.bgHitArea.setInteractive();
  }
}

// ── Bottom panel (stone shelf / dungeon floor foreground) ───────────────────
//
// Visually continuous with the dungeon floor tiles in the background.
// The stone ledge top edge at bz.top acts as a step, separating the stage
// (where combat plays out) from the player action zone below.

function drawBottomPanelStone(g, edge, bz, W, H) {
  g.clear();

  // ── Stone floor base (same tile system as background) ────────────────
  g.fillStyle(0x1a1410, 1);
  g.fillRect(0, bz.top, W, H - bz.top);

  const tw = Math.max(48, Math.round(W / 20));
  const th = Math.round(tw * 0.46);
  g.lineStyle(1, 0x0c0806, 0.55);
  for (let row = 0; row < 10; row += 1) {
    const fy = bz.top + 24 + row * th;
    if (fy > H) break;
    g.lineBetween(0, fy, W, fy);
    for (let col = 0; col < Math.ceil(W / tw) + 2; col += 1) {
      const ox = row % 2 === 0 ? 0 : tw * 0.5;
      const fx = col * tw + ox - tw * 0.5;
      g.lineBetween(fx, fy, fx, Math.min(fy + th, H));
    }
  }

  // Torch warmth reflection pooling at player and action columns
  g.fillStyle(0xcc8830, 0.05);
  g.fillEllipse(
    Math.round(bz.leftCX),
    Math.round(bz.top + bz.h * 0.38),
    Math.round(bz.leftW * 1.3),
    Math.round(bz.leftW * 0.7),
  );
  g.fillStyle(0xcc8830, 0.04);
  g.fillEllipse(
    Math.round(bz.rightCX),
    Math.round(bz.top + bz.h * 0.33),
    Math.round(bz.rightW * 1.3),
    Math.round(bz.rightW * 0.6),
  );

  if (!edge?.active) return;

  edge.clear();

  // ── Stone ledge top edge ─────────────────────────────────────────────
  // Shadow cast by the wall above
  edge.fillGradientStyle(0x060402, 0x060402, 0x1a1410, 0x1a1410, 1);
  edge.fillRect(0, bz.top, W, 10);
  // Top face of the carved stone ledge (catches torch light)
  edge.fillStyle(0x3c2a1c, 1);
  edge.fillRect(0, bz.top + 10, W, 10);
  // Front face of ledge (shadowed underside)
  edge.fillStyle(0x241810, 1);
  edge.fillRect(0, bz.top + 20, W, 7);
  // Torchlight glint on top surface
  edge.lineStyle(1, 0x5a4030, 0.55);
  edge.lineBetween(0, bz.top + 12, W, bz.top + 12);
  // Bottom shadow line
  edge.lineStyle(1, 0x0a0806, 0.80);
  edge.lineBetween(0, bz.top + 27, W, bz.top + 27);

  // Zone dividers: player zone | hand zone | action zone
  const divL = Math.round(bz.leftCX + bz.leftW * 0.56);
  const divR = Math.round(bz.rightCX - bz.rightW * 0.56);
  edge.lineStyle(1, 0x2c1e12, 0.80);
  edge.lineBetween(divL, bz.top + 10, divL, H);
  edge.lineBetween(divR, bz.top + 10, divR, H);
  // Inner highlight of dividers
  edge.lineStyle(1, 0x4a3828, 0.22);
  edge.lineBetween(divL + 1, bz.top + 10, divL + 1, H);
  edge.lineBetween(divR + 1, bz.top + 10, divR + 1, H);
}

function buildBottomPanel(scene, ui) {
  ui.bottomPanelBg = scene.add.graphics().setDepth(2);
  ui.bottomPanelEdge = scene.add.graphics().setDepth(3);
  relayoutBottomPanel(scene, ui);
}

function relayoutBottomPanel(scene, ui) {
  if (!ui.bottomPanelBg?.active) return;
  const bz = scene.layout.bottomZone;
  drawBottomPanelStone(ui.bottomPanelBg, ui.bottomPanelEdge ?? null, bz, scene.W, scene.H);
}

function buildHud(scene, ui, options) {
  const hud = scene.layout.hud;

  ui.turnPlate = createSkinnedTurnPlate(scene, {
    x: hud.x,
    y: hud.y,
    text: '第 1 回',
    floor: options.scenarioName ?? '深渊试炼',
  });

  // 标题盘已移除

  // 结束回合按钮移到右下
  const et = scene.layout.endTurn;
  ui.endTurnSkin = createSkinnedEndTurnButton(scene, {
    x: et.x,
    y: et.y,
    label: '结束回合',
  });
  const endTurnButton = ui.endTurnSkin.bg;
  endTurnButton.on('pointerdown', () => options.onEndTurnPressed?.());
  endTurnButton.on('pointerover', () => {
    refreshEndTurnButton(ui, options.getMode?.() ?? BATTLE_MODES.loading, true);
  });
  endTurnButton.on('pointerout', () => {
    refreshEndTurnButton(ui, options.getMode?.() ?? BATTLE_MODES.loading, false);
  });

  // pause button — top-right corner
  const pbSize = 36;
  const pbX = scene.W - 28;
  const pbY = 28;
  const pbBg = scene.add
    .circle(pbX, pbY, pbSize * 0.56, 0xffd56a, 1)
    .setStrokeStyle(3, COLORS.outlineStrong, 0.9)
    .setDepth(100)
    .setInteractive({ useHandCursor: true });
  const pbLabel = scene.add
    .text(pbX, pbY, '≡', {
      fontFamily: FONT_UI,
      fontSize: '20px',
      color: '#3a281c',
    })
    .setOrigin(0.5)
    .setDepth(101);
  enhanceTextQuality(pbLabel, { style: { fontFamily: FONT_UI, fontSize: '20px' } });
  pbBg.on('pointerover', () => { pbBg.setFillStyle(0xffe08d, 1); pbBg.setScale(1.06); });
  pbBg.on('pointerout', () => { pbBg.setFillStyle(0xffd56a, 1); pbBg.setScale(1); });
  pbBg.on('pointerdown', () => options.onPausePressed?.());
  ui.pauseButton = pbBg;
  ui.pauseLabel = pbLabel;

  const piles = scene.layout.piles;
  ui.drawPile = createPileWidget(scene, { x: piles.draw.x, y: piles.draw.y, label: '抽', color: COLORS.pileDraw });
  ui.discardPile = createPileWidget(scene, { x: piles.discard.x, y: piles.discard.y, label: '弃', color: COLORS.pileDiscard });
  ui.exhaustPile = createPileWidget(scene, { x: piles.exhaust.x, y: piles.exhaust.y, label: '焚', color: COLORS.pileExhaust });

  // Energy badge — oversized and numeric-only so temporary energy gains are obvious
  const bz = scene.layout.bottomZone;
  const eX = bz.leftCX;
  const eY = bz.top + 48;
  ui.energyBadge = scene.add.container(eX, eY).setDepth(82);

  const energyShadow = scene.add.ellipse(0, 28, 108, 18, COLORS.shadow, 0.18);
  const energyShell = scene.add.ellipse(0, 0, 148, 82, 0x24352a, 0.96)
    .setStrokeStyle(4, 0x101612, 0.92);
  const energyCore = scene.add.ellipse(0, -2, 128, 60, 0xf2dd9d, 1)
    .setStrokeStyle(2, 0xfff4cb, 0.5);
  const energyGlow = scene.add.ellipse(0, -16, 96, 22, 0xffffff, 0.16);
  ui.energyText = scene.add.text(0, -1, '3 / 3', {
    fontFamily: FONT_DISPLAY,
    fontSize: '24px',
    color: '#2d1b10',
    fontStyle: 'bold',
    stroke: '#fff7df',
    strokeThickness: 2,
  }).setOrigin(0.5);
  enhanceTextQuality(ui.energyText, {
    style: { fontFamily: FONT_DISPLAY, fontSize: '24px' },
    shadowColor: 'rgba(62, 38, 18, 0.18)',
  });
  ui.energyShell = energyShell;
  ui.energyCore = energyCore;
  ui.energyGlow = energyGlow;
  ui.energyBadge.add([energyShadow, energyShell, energyCore, energyGlow, ui.energyText]);
  ui.relicBar = createRelicBar(scene);

  ui.toast = scene.add.text(scene.layout.hand.x, scene.layout.hand.y - scene.layout.hand.h / 2 - 22, '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '22px',
    color: COLORS.textMain,
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0).setDepth(220);
  enhanceTextQuality(ui.toast, {
    style: { fontFamily: FONT_DISPLAY, fontSize: '22px' },
    shadowColor: 'rgba(18, 12, 8, 0.24)',
  });

  applyModeToHud(ui, BATTLE_MODES.loading);
  relayoutHud(scene, ui);
}

function relayoutHud(scene, ui) {
  const hud = scene.layout.hud;
  const piles = scene.layout.piles;
  const bz = scene.layout.bottomZone;
  const et = scene.layout.endTurn;

  ui.turnPlate?.container?.setPosition(hud.x, hud.y);
  ui.endTurnSkin?.container?.setPosition(et.x, et.y);
  ui.pauseButton?.setPosition(scene.W - 28, 28);
  ui.pauseLabel?.setPosition(scene.W - 28, 28);
  ui.drawPile?.container?.setPosition(piles.draw.x, piles.draw.y);
  ui.discardPile?.container?.setPosition(piles.discard.x, piles.discard.y);
  ui.exhaustPile?.container?.setPosition(piles.exhaust.x, piles.exhaust.y);
  ui.energyBadge?.setPosition(bz.leftCX, bz.top + 48);
  relayoutRelicBar(scene, ui.relicBar);
  ui.toast?.setPosition(scene.layout.hand.x, scene.layout.hand.y - scene.layout.hand.h / 2 - 22);
}

function buildStage(scene, ui, options) {
  const stage = scene.layout.stage;

  options.createPlayerNode?.({ name: '' });

  ui.banner = scene.add.text(stage.x, scene.H * 0.10, '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '58px',
    color: '#fff7d6',
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0).setDepth(180);
  enhanceTextQuality(ui.banner, {
    style: { fontFamily: FONT_DISPLAY, fontSize: '58px' },
    shadowColor: 'rgba(20, 12, 8, 0.26)',
  });

  ui.targetHint = scene.add.text(stage.x, stage.y + stage.h / 2 - 8, '', {
    fontFamily: FONT_UI,
    fontSize: '15px',
    color: COLORS.textSoft,
    fontStyle: 'bold',
  }).setOrigin(0.5).setVisible(false).setDepth(170);
  enhanceTextQuality(ui.targetHint, {
    style: { fontFamily: FONT_UI, fontSize: '15px' },
    shadowColor: 'rgba(16, 10, 8, 0.18)',
  });

  ui.targetLine = scene.add.graphics().setDepth(168);
  ui.playZone = createDropZone(scene, {
    x: stage.x + stage.w * 0.04,
    y: stage.y + stage.h * 0.1,
    width: 208,
    height: 54,
    label: '落牌',
    depth: 166,
    strokeColor: COLORS.targetGlow,
    fillColor: COLORS.shelf,
  });
  relayoutStage(scene, ui);
}

function relayoutStage(scene, ui) {
  const stage = scene.layout.stage;
  ui.banner?.setPosition(stage.x, scene.H * 0.10);
  ui.targetHint?.setPosition(stage.x, stage.y + stage.h / 2 - 8);
  relayoutDropZone(ui.playZone, {
    x: stage.x + stage.w * 0.04,
    y: stage.y + stage.h * 0.1,
    width: 208,
    height: 54,
  });
}

function buildHandShelf(scene, ui) {
  const hand = scene.layout.hand;

  ui.handLabel = scene.add.text(hand.x, hand.y - 56, '手札', {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: '#5d4327',
    fontStyle: 'bold',
    letterSpacing: 4,
  }).setOrigin(0.5).setDepth(42).setAlpha(0.9);

  ui.handZone = createDropZone(scene, {
    x: hand.x,
    y: hand.y,
    width: hand.w * 0.9,
    height: 72,
    label: '归手',
    depth: 46,
    strokeColor: COLORS.frameSoft,
    fillColor: COLORS.panelSoft,
  });
  relayoutHandShelf(scene, ui);
}

function relayoutHandShelf(scene, ui) {
  const hand = scene.layout.hand;
  ui.handLabel?.setPosition(hand.x, hand.y - 56);
  relayoutDropZone(ui.handZone, {
    x: hand.x,
    y: hand.y,
    width: hand.w * 0.9,
    height: 72,
  });
}

function buildOverlay(scene, ui) {
  ui.overlayBg = scene.add.rectangle(scene.W / 2, scene.H / 2, scene.W, scene.H, 0x06080b, 0)
    .setDepth(290);
  ui.overlayText = scene.add.text(scene.W / 2, scene.H / 2, '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '86px',
    color: COLORS.textMain,
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0).setDepth(291);
  relayoutOverlay(scene, ui);
}

function relayoutOverlay(scene, ui) {
  ui.overlayBg?.setPosition(scene.W / 2, scene.H / 2);
  resizeRect(ui.overlayBg, scene.W, scene.H);
  ui.overlayText?.setPosition(scene.W / 2, scene.H / 2);
}

function createDropZone(scene, {
  x,
  y,
  width,
  height,
  label,
  depth,
  strokeColor,
  fillColor,
}) {
  const container = scene.add.container(x, y).setDepth(depth).setVisible(false);
  const fill = scene.add.rectangle(0, 0, width, height, fillColor, 0.08);
  const frame = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.01)
    .setStrokeStyle(3, COLORS.outlineStrong, 0.22);
  const inner = scene.add.rectangle(0, 0, width - 10, height - 10, 0xffffff, 0.01)
    .setStrokeStyle(2, strokeColor, 0.34);
  const labelText = scene.add.text(0, -height / 2 - 12, label, {
    fontFamily: FONT_UI,
    fontSize: '10px',
    color: '#fff5dd',
    fontStyle: 'bold',
    letterSpacing: 2,
  }).setOrigin(0.5).setAlpha(0.86);

  container.add([fill, frame, inner, labelText]);

  return {
    container,
    fill,
    frame,
    inner,
    label: labelText,
  };
}

