import { COLORS, LAYOUT } from '../../../src/constants.js';
import { setDebugName } from '../support/battleDebug.js';

const TEXTURES = {
  cardGlow: 'battle-skin-card-glow',
  cardAttack: 'battle-skin-card-attack',
  cardSkill: 'battle-skin-card-skill',
  cardPower: 'battle-skin-card-power',
  cardNeutral: 'battle-skin-card-neutral',
};

const FONT_UI = '"Trebuchet MS", "Verdana", sans-serif';
const FONT_DISPLAY = '"Georgia", "Times New Roman", serif';
const BUTTON_STATES = {
  active: {
    fill: 0xffd36a,
    band: 0xffefb4,
    stroke: 0x3b2719,
    glow: 0.1,
    alpha: 1,
    labelAlpha: 1,
    subAlpha: 0.9,
    scale: 1,
  },
  hover: {
    fill: 0xffe089,
    band: 0xfff5c8,
    stroke: 0x3b2719,
    glow: 0.2,
    alpha: 1,
    labelAlpha: 1,
    subAlpha: 1,
    scale: 1.04,
  },
  disabled: {
    fill: 0xc8bbaa,
    band: 0xe5dccf,
    stroke: 0x7f7266,
    glow: 0,
    alpha: 0.82,
    labelAlpha: 0.72,
    subAlpha: 0.56,
    scale: 1,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-type glowing sigil motifs drawn on a DARK dungeon background.
// artCY = center-y of the art area in texture space.
// Each motif draws a wide low-alpha corona first, then the bright main shape.
// ─────────────────────────────────────────────────────────────────────────────
function drawArtMotif(g, type, color, W, artCY) {
  const cx = W / 2;
  const cy = artCY;

  if (type === 'attack') {
    // Corona glow behind crossed blades
    g.lineStyle(10, color, 0.20);
    g.lineBetween(cx - 26, cy - 30, cx + 26, cy + 30);
    g.lineBetween(cx + 26, cy - 30, cx - 26, cy + 30);
    // Bold X — forge-crossed blades, bright on dark
    g.lineStyle(4.5, color, 0.92);
    g.lineBetween(cx - 26, cy - 30, cx + 26, cy + 30);
    g.lineBetween(cx + 26, cy - 30, cx - 26, cy + 30);
    // Strike lines
    g.lineStyle(1.5, color, 0.30);
    for (let i = -2; i <= 2; i += 1) g.lineBetween(cx - 36, cy + i * 10, cx + 36, cy + i * 10);
    // Center gem glow
    g.fillStyle(color, 0.92);
    g.fillCircle(cx, cy, 5);
    g.fillStyle(0xffffff, 0.68);
    g.fillCircle(cx - 1, cy - 1, 2);
  } else if (type === 'skill') {
    // Corona halo around ward circle
    g.lineStyle(9, color, 0.18);
    g.strokeCircle(cx, cy, 28);
    // Ward circle with cardinal spokes
    g.lineStyle(2.5, color, 0.90);
    g.strokeCircle(cx, cy, 28);
    g.lineStyle(1.5, color, 0.55);
    g.strokeCircle(cx, cy, 14);
    g.lineStyle(2, color, 0.80);
    g.lineBetween(cx - 38, cy, cx + 38, cy);
    g.lineBetween(cx, cy - 38, cx, cy + 38);
    g.lineStyle(1.5, color, 0.42);
    g.lineBetween(cx - 26, cy - 26, cx + 26, cy + 26);
    g.lineBetween(cx - 26, cy + 26, cx + 26, cy - 26);
    g.fillStyle(color, 0.88);
    [0, 1, 2, 3].forEach(i => {
      const a = i * Math.PI / 2;
      g.fillCircle(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, 3.5);
    });
    g.fillCircle(cx, cy, 4.5);
  } else if (type === 'power') {
    // 4-pointed ornate star / altar seal
    const outerR = 30; const innerR = 10;
    // Corona
    g.lineStyle(9, color, 0.18);
    g.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR + 6 : innerR;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath(); g.strokePath();
    // Main star
    g.lineStyle(3, color, 0.92);
    g.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath(); g.strokePath();
    g.lineStyle(1.5, color, 0.35);
    g.strokeCircle(cx, cy, 36);
    g.fillStyle(color, 0.90);
    g.fillCircle(cx, cy, 5.5);
    g.fillStyle(0xffffff, 0.62);
    g.fillCircle(cx - 1.5, cy - 1.5, 2.5);
    g.fillStyle(color, 0.58);
    [[-36, 0], [36, 0], [0, -36], [0, 36]].forEach(([dx, dy]) => g.fillCircle(cx + dx, cy + dy, 3));
  } else {
    // Diamond rune + cross axis
    const s = 26;
    // Corona
    g.lineStyle(7, color, 0.18);
    g.beginPath();
    g.moveTo(cx, cy - s); g.lineTo(cx + s, cy);
    g.lineTo(cx, cy + s); g.lineTo(cx - s, cy);
    g.closePath(); g.strokePath();
    // Main diamond
    g.lineStyle(2.5, color, 0.90);
    g.beginPath();
    g.moveTo(cx, cy - s); g.lineTo(cx + s, cy);
    g.lineTo(cx, cy + s); g.lineTo(cx - s, cy);
    g.closePath(); g.strokePath();
    g.lineStyle(1.5, color, 0.55);
    g.beginPath();
    g.moveTo(cx, cy - 13); g.lineTo(cx + 13, cy);
    g.lineTo(cx, cy + 13); g.lineTo(cx - 13, cy);
    g.closePath(); g.strokePath();
    g.lineStyle(1, color, 0.30);
    g.lineBetween(cx - s, cy, cx + s, cy);
    g.lineBetween(cx, cy - s, cx, cy + s);
    g.fillStyle(color, 0.88);
    g.fillCircle(cx, cy, 4);
    [[-s, 0], [s, 0], [0, -s], [0, s]].forEach(([dx, dy]) => g.fillCircle(cx + dx, cy + dy, 3));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Card body texture — 164×224.  Dungeon stone/obsidian tablet:
//
//   y  0-54   Name header  (very dark type-stone, chiseled name)  ← TOP
//   y 54-56   type-light separator glow
//   y 56-156  Art area     (near-black vault, glowing sigil)        ← MIDDLE
//   y156-158  separator
//   y158-220  Desc scroll  (dark carved inscription stone)          ← BOTTOM
//   y  0-224  outer metal frame  (drawn last)
//
// Container coords (origin = card center = 82, 112):
//   cost gem:    (-56, -85)   texture (26, 27)
//   card name:   (+12, -86)   in top header
//   tags line:   (+12, -72)   below name in header
//   art center:  (  0,  -5)   texture cy = 107
//   desc start:  (  0, +50)   texture y = 162
// ─────────────────────────────────────────────────────────────────────────────
function drawCardBodyTexture(scene, key, type, palette) {
  const W = LAYOUT.cardSize.w;   // 164
  const H = LAYOUT.cardSize.h;   // 224
  const g = scene.make.graphics({ add: false });

  // Drop shadow (heavier on dark cards)
  g.fillStyle(0x000000, 0.60);
  g.fillRoundedRect(5, 8, W, H, 12);

  // Outer metal frame (type frame color)
  g.fillStyle(palette.frame, 1);
  g.fillRoundedRect(0, 0, W, H, 12);

  // Inner dark face fill
  g.fillStyle(palette.face, 1);
  g.fillRoundedRect(4, 4, W - 8, H - 8, 8);

  // ── Name header (very dark type-stone) ──────────────────────────────────
  g.fillStyle(palette.header, 1);
  g.fillRoundedRect(4, 4, W - 8, 50, { tl: 8, tr: 8, bl: 0, br: 0 });
  // Torch-shimmer at very top (hot spot from torch above)
  g.fillGradientStyle(0xffffff, 0xffffff, palette.header, palette.header, 0.07);
  g.fillRoundedRect(4, 4, W - 8, 16, { tl: 8, tr: 8, bl: 0, br: 0 });

  // Cost gem
  g.fillStyle(0x000000, 0.72);
  g.fillCircle(26, 27, 16);
  g.fillStyle(palette.gem, 1);
  g.fillCircle(26, 27, 14);
  g.fillStyle(0xffffff, 0.24);
  g.fillCircle(22, 23, 5);
  g.fillStyle(0xffffff, 0.10);
  g.fillCircle(25, 26, 9);

  // Header–art separator (type-light glow line)
  g.lineStyle(2, palette.frameLight, 0.55);
  g.lineBetween(4, 54, W - 4, 54);

  // ── Art area (near-black vault with torch-lit glow from above) ──────────
  const artY1 = 56;
  const artY2 = 156;
  g.fillStyle(palette.artBg, 1);
  g.fillRect(4, artY1, W - 8, artY2 - artY1);
  // Torch-haze from top (as if torch light leaks over the top edge)
  g.fillGradientStyle(palette.artTint, palette.artTint, palette.artBg, palette.artBg, 0.26);
  g.fillRect(4, artY1, W - 8, 28);
  // Subtle type-edge inner frame
  g.lineStyle(1, palette.frameLight, 0.12);
  g.strokeRect(5, artY1 + 1, W - 10, artY2 - artY1 - 2);

  // Glowing sigil motif
  const artCY = (artY1 + artY2) / 2;  // 106
  drawArtMotif(g, type, palette.symbol, W, artCY);

  // Art–desc separator
  g.lineStyle(2, palette.frameLight, 0.36);
  g.lineBetween(4, artY2, W - 4, artY2);

  // ── Desc inscription (dark carved stone panel) ──────────────────────────
  const scrollY = artY2 + 2;
  g.fillStyle(palette.scroll, 1);
  g.fillRoundedRect(4, scrollY, W - 8, H - 4 - scrollY, { tl: 0, tr: 0, bl: 8, br: 8 });
  // Bevel top edge catches type-light
  g.lineStyle(1, palette.frameLight, 0.20);
  g.lineBetween(6, scrollY + 1, W - 6, scrollY + 1);
  // Faint rune-lines (tonal engraving on stone)
  g.lineStyle(1, palette.symbol, 0.06);
  for (let i = 0; i < 4; i += 1) g.lineBetween(12, scrollY + 8 + i * 13, W - 12, scrollY + 8 + i * 13);

  // Outer rim — type-light edge glow, dark inner line
  g.lineStyle(2, palette.frameLight, 0.42);
  g.strokeRoundedRect(0, 0, W, H, 12);
  g.lineStyle(1, 0x000000, 0.60);
  g.strokeRoundedRect(4, 4, W - 8, H - 8, 8);

  g.generateTexture(key, W, H);
  g.destroy();
}

function generateCardGlowTexture(scene, key) {
  const width = LAYOUT.cardSize.w + 18;
  const height = LAYOUT.cardSize.h + 18;
  const graphics = scene.make.graphics({ add: false });

  graphics.clear();
  // Outer soft amber halo (wider corona for dark card environment)
  graphics.lineStyle(10, 0xffd36a, 0.10);
  graphics.strokeRoundedRect(2, 2, width - 4, height - 4, 26);
  // Mid glow band
  graphics.lineStyle(5, 0xffcf6a, 0.22);
  graphics.strokeRoundedRect(5, 5, width - 10, height - 10, 24);
  // Inner precise glow line
  graphics.lineStyle(2.5, 0xffc56d, 0.88);
  graphics.strokeRoundedRect(9, 9, width - 18, height - 18, 20);
  // Bright innermost trim
  graphics.lineStyle(1, 0xfff0a0, 0.52);
  graphics.strokeRoundedRect(13, 13, width - 26, height - 26, 17);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function ensureBattleSkinTextures(scene) {
  if (scene.textures.exists(TEXTURES.cardAttack)) return TEXTURES;

  generateCardGlowTexture(scene, TEXTURES.cardGlow);

  // Attack — Blood Forge (dark iron, ember crimson glow)
  drawCardBodyTexture(scene, TEXTURES.cardAttack, 'attack', {
    frame:      0x5a1a0c,
    frameLight: 0xcc3820,
    face:       0x1a0c08,
    header:     0x2e0e08,
    gem:        0x9e1e0e,
    artBg:      0x120806,
    artTint:    0x7c1a08,
    scroll:     0x261410,
    symbol:     0xff5828,
  });

  // Skill — Dungeon Rune (dark jade stone, runic jade glow)
  drawCardBodyTexture(scene, TEXTURES.cardSkill, 'skill', {
    frame:      0x143420,
    frameLight: 0x40926a,
    face:       0x0c1810,
    header:     0x0c2012,
    gem:        0x166030,
    artBg:      0x0a1208,
    artTint:    0x246040,
    scroll:     0x182412,
    symbol:     0x58ee88,
  });

  // Power — Altar Gold (obsidian base, divine torch gold)
  drawCardBodyTexture(scene, TEXTURES.cardPower, 'power', {
    frame:      0x523808,
    frameLight: 0xe8a010,
    face:       0x1a1008,
    header:     0x301c06,
    gem:        0x906810,
    artBg:      0x140c04,
    artTint:    0x886010,
    scroll:     0x221804,
    symbol:     0xffc830,
  });

  // Neutral — Ancient Stone (worn granite, old bronze gleam)
  drawCardBodyTexture(scene, TEXTURES.cardNeutral, 'neutral', {
    frame:      0x38281a,
    frameLight: 0x6e5038,
    face:       0x18120c,
    header:     0x221610,
    gem:        0x5e4228,
    artBg:      0x100c08,
    artTint:    0x4a3020,
    scroll:     0x1e1810,
    symbol:     0xc89060,
  });

  return TEXTURES;
}

function cardTextureByType(type) {
  if (type === 'attack') return TEXTURES.cardAttack;
  if (type === 'skill') return TEXTURES.cardSkill;
  if (type === 'power') return TEXTURES.cardPower;
  return TEXTURES.cardNeutral;
}

function applyButtonVisual(node, state) {
  const palette = BUTTON_STATES[state];
  node.bg.setFillStyle(palette.fill, palette.alpha);
  node.bg.setStrokeStyle(1.5, palette.stroke, 0.54);
  node.band.setFillStyle(palette.band, palette.alpha);
  node.glow.setAlpha(palette.glow);
  node.label?.setAlpha(palette.labelAlpha);
  node.subLabel?.setAlpha(palette.subAlpha);
  node.container?.setScale(palette.scale);
}

export function createSkinnedEndTurnButton(scene, { x, y, label }) {
  const container = scene.add.container(x, y).setDepth(24);
  const shadow = scene.add.ellipse(0, 26, 188, 16, COLORS.shadow, 0.12);
  const glow = scene.add.rectangle(0, 0, 236, 60, 0xffffff, 0.01)
    .setStrokeStyle(4, 0xffefb0, 0)
    .setAlpha(0);
  const back = scene.add.rectangle(0, 6, 214, 46, 0x6d421d, 0.86)
    .setStrokeStyle(3, 0x342114, 0.38);
  const bg = scene.add.rectangle(0, 0, 214, 46, BUTTON_STATES.active.fill, 1)
    .setStrokeStyle(3, BUTTON_STATES.active.stroke, 0.92)
    .setInteractive({ useHandCursor: true });
  const band = scene.add.rectangle(0, -10, 198, 14, BUTTON_STATES.active.band, 0.96);
  const spark = scene.add.circle(74, -9, 5, 0xffffff, 0.9);
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONT_DISPLAY,
    fontSize: '20px',
    color: '#3b2719',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  container.add([shadow, glow, back, bg, band, spark, text]);

  const node = {
    container,
    back,
    bg,
    glow,
    band,
    spark,
    label: text,
    subLabel: null,
    hovered: false,
  };
  setDebugName(container, 'hud.endTurn.container');
  setDebugName(back, 'hud.endTurn.back');
  setDebugName(bg, 'hud.endTurn.button');
  setDebugName(glow, 'hud.endTurn.glow');
  setDebugName(band, 'hud.endTurn.band');
  setDebugName(spark, 'hud.endTurn.spark');
  setDebugName(text, 'hud.endTurn.label');
  return node;
}

export function createSkinnedTurnPlate(scene, { x, y, text, floor = '—' }) {
  // ── Dungeon Dashboard ───────────────────────────────────────────────────
  // A centered stone slab divided into two data compartments:
  //   LEFT  → 关卡 (floor/scenario name)
  //   RIGHT → 回合 (turn count)
  const container = scene.add.container(x, y).setDepth(22);

  // Stone slab backing
  const slab = scene.add.rectangle(0, 0, 300, 46, 0x130d09, 0.94)
    .setStrokeStyle(2, 0x4e2c12, 0.75);
  // Top torch-bevel
  const bevel = scene.add.rectangle(0, -21, 292, 2, 0x7a4828, 0.36);
  // Centre divider
  const divider = scene.add.rectangle(0, 1, 2, 30, 0x4e2c12, 0.60);
  // Subtle inner glow at the top edge of each compartment
  const leftGlow  = scene.add.rectangle(-75, -14, 126, 2, 0xcc8830, 0.18);
  const rightGlow = scene.add.rectangle( 75, -14, 126, 2, 0xcc8830, 0.18);

  // ── Left slot: 关卡 ──────────────────────────────────────────────────
  const floorSlotLabel = scene.add.text(-75, -10, '关　卡', {
    fontFamily: FONT_UI,
    fontSize: '9px',
    color: '#7a5830',
    fontStyle: 'bold',
    letterSpacing: 2,
  }).setOrigin(0.5);
  const floorLabel = scene.add.text(-75, 7, floor, {
    fontFamily: FONT_DISPLAY,
    fontSize: '14px',
    color: '#d4b880',
    fontStyle: 'bold',
    stroke: '#080502',
    strokeThickness: 1,
  }).setOrigin(0.5);

  // ── Right slot: 回合 ─────────────────────────────────────────────────
  const turnSlotLabel = scene.add.text(75, -10, '回　合', {
    fontFamily: FONT_UI,
    fontSize: '9px',
    color: '#7a5830',
    fontStyle: 'bold',
    letterSpacing: 2,
  }).setOrigin(0.5);
  const label = scene.add.text(75, 7, text, {
    fontFamily: FONT_DISPLAY,
    fontSize: '18px',
    color: '#e8d4a0',
    fontStyle: 'bold',
    stroke: '#070402',
    strokeThickness: 1,
  }).setOrigin(0.5);

  container.add([slab, bevel, leftGlow, rightGlow, divider,
    floorSlotLabel, floorLabel, turnSlotLabel, label]);

  const node = {
    container,
    bg: slab,
    badge: null,
    sub: turnSlotLabel,
    label,
    floorLabel,
    lastText: text,
  };
  setDebugName(container, 'hud.turnPlate.container');
  setDebugName(slab, 'hud.turnPlate.bg');
  setDebugName(divider, 'hud.turnPlate.divider');
  setDebugName(floorLabel, 'hud.turnPlate.floorLabel');
  setDebugName(label, 'hud.turnPlate.label');
  return node;
}

export function pulseSkinnedTurnPlate(scene, plate, text) {
  if (!plate?.label) return;

  if (text != null && text !== plate.lastText) {
    plate.label.setText(text);
    plate.lastText = text;
  }

  scene.tweens.killTweensOf(plate.container);
  scene.tweens.add({
    targets: plate.container,
    scaleX: 1.03,
    scaleY: 1.03,
    duration: 120,
    ease: 'Quad.Out',
    yoyo: true,
  });
}

export function setSkinnedEndTurnButtonState(node, { enabled, hovered }) {
  if (!node?.bg) return;

  node.hovered = hovered && enabled;
  if (!enabled) {
    applyButtonVisual(node, 'disabled');
    return;
  }

  applyButtonVisual(node, node.hovered ? 'hover' : 'active');
}

export function createSkinnedPileWidget(scene, { x, y, label, accentColor, debugKey = null }) {
  const accentHex = typeof accentColor === 'number' ? accentColor : parseInt(String(accentColor).replace('#', ''), 16);
  const accentCSS = '#' + accentHex.toString(16).padStart(6, '0');
  const container = scene.add.container(x, y).setDepth(72);

  // Dark pill background
  const bg = scene.add.rectangle(0, 0, 56, 40, 0x1a1208, 0.9)
    .setStrokeStyle(1.5, accentHex, 0.5)
    .setInteractive({ useHandCursor: true });

  const count = scene.add.text(0, -5, '0', {
    fontFamily: FONT_DISPLAY,
    fontSize: '18px',
    color: accentCSS,
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const title = scene.add.text(0, 13, label, {
    fontFamily: FONT_UI,
    fontSize: '9px',
    color: '#8a7a6a',
    letterSpacing: 1,
  }).setOrigin(0.5);

  container.add([bg, count, title]);
  container.setSize(56, 40);

  bg.on('pointerover', () => {
    bg.setStrokeStyle(2, accentHex, 0.9);
    bg.setFillStyle(0x2a1e12, 0.95);
    container.setScale(1.08);
  });
  bg.on('pointerout', () => {
    bg.setStrokeStyle(1.5, accentHex, 0.5);
    bg.setFillStyle(0x1a1208, 0.9);
    container.setScale(1);
  });

  const node = { container, bg, title, count, lastCount: null };
  if (debugKey) {
    setDebugName(container, `${debugKey}.container`);
    setDebugName(count, `${debugKey}.count`);
  }
  return node;
}

export function createSkinnedCardBase(scene, { type }) {
  ensureBattleSkinTextures(scene);

  const texture = cardTextureByType(type);
  const body = scene.add.image(0, 0, texture);
  const glow = scene.add.image(0, 0, TEXTURES.cardGlow).setAlpha(0);

  return {
    body,
    glow,
    texture,
  };
}

export function updateSkinnedCardBase(node, type) {
  const texture = cardTextureByType(type);
  node?.body?.setTexture(texture);
  node.texture = texture;
}

