import { loadBuiltInScenario } from '../../../games/sts/src/index.js';

export const DEMO_SCENARIO = loadBuiltInScenario('starter');

export const COLORS = {
  bgTop: 0xf4efe5,
  bgBottom: 0xcfc8bd,
  skyTop: 0x8ec5ff,
  skyMid: 0xd0eeff,
  skyBottom: 0xfef4d7,
  sun: 0xffd56a,
  cloud: 0xfffcf3,
  hillBack: 0x8cc7a2,
  hillMid: 0x58a07d,
  hillFront: 0x2e6f57,
  grass: 0x2d6c4d,
  grassLight: 0x5ba56f,
  dirt: 0x8f5d3b,
  dirtDark: 0x5d3925,
  hazeTeal: 0x182126,
  hazeGold: 0x7a6854,
  hazeCoral: 0x5d3e37,
  mist: 0xf6f0e5,
  water: 0xd0c7b9,
  waterDeep: 0x978f85,
  inkWash: 0x1a1b1d,
  inkSoft: 0x5a5f66,

  panel: 0xf8f2e8,
  panelSoft: 0xede4d7,
  panelWarm: 0xfff5d8,
  shelf: 0xddd1bf,
  frame: 0x191614,
  frameSoft: 0x7d7369,
  outlineStrong: 0x2b2118,

  textMain: '#181412',
  textSoft: '#4b433e',
  textDim: '#776c61',
  textDark: '#f7f0e6',

  accentGold: '#8a6a3d',
  accentTeal: '#4d676e',
  accentCoral: '#6b3931',
  accentRose: '#8f5f58',

  hp: 0x1a1816,
  hpBack: 0xcec0b0,
  hpLag: 0x6b625b,
  block: 0x6b665f,
  heal: 0x2f5b53,
  danger: 0x2c1614,

  actorCore: 0x241c19,
  actorFlash: 0xffffff,

  cardAttack: 0xebe0d1,
  cardSkill: 0xf3ebdf,
  cardPower: 0xe1d3c1,
  cardNeutral: 0xeee5d8,
  cardFace: 0xfbf6ef,
  cardEdge: 0x1b1715,
  cardGlow: 0x3a2f2a,
  cardMuted: 0xa89f96,
  cardInk: '#1b1715',

  pileDraw: 0xe4d8c7,
  pileDiscard: 0xd5c7b6,
  pileExhaust: 0xc6b7a7,

  targetLine: 0x4e4037,
  targetGlow: 0xa07a54,
  buttonDisabled: 0x978b7d,
  shadow: 0x080808,
};

export const LAYOUT = {
  width: 1440,
  height: 900,
  margin: 28,
  hudHeight: 118,
  handHeight: 282,
  cardSize: { w: 164, h: 224 },
  playerAnchorRatio: { x: 0.2, y: 0.57 },
  enemyAreaRatio: { x: 0.68, y: 0.43, w: 0.42, h: 0.3 },
};

export const TIMING = {
  hover: 120,
  settle: 220,
  banner: 520,
  play: 250,
  lunge: 150,
  recoil: 160,
  draw: 240,
  float: 520,
  flash: 220,
  pauseTiny: 70,
  pauseSmall: 130,
};

export const CARD_UI = {
  hand: {
    innerPadding: 120,
    minSpacing: 84,
    maxSpacing: 132,
    maxAngle: 18,
    edgeLift: 18,
    arcLift: 12,
    baseOffsetY: 24,
  },
  hover: {
    lift: 46,
    scale: 1.12,
    normalizeRotation: true,
  },
  targeting: {
    lift: 58,
    scale: 1.16,
    normalizeRotation: true,
  },
  drag: {
    scale: 1.08,
    tiltFactor: 260,
    maxTilt: 0.18,
    cursorOffsetY: 20,
  },
  motion: {
    hoverGlow: 0.18,
    selectedGlow: 0.22,
    shadowHoverAlpha: 0.15,
    shadowIdleAlpha: 0.09,
    disabledAlpha: 0.42,
  },
  draw: {
    startScale: 0.64,
    startAlpha: 0.08,
    startRotation: -0.18,
  },
  discard: {
    endScale: 0.5,
  },
};

/**
 * DEPTH — 渲染层级（z-index）
 *
 * 数值越大越靠上。分层设计确保视觉元素互不遮挡：
 *
 * 000-019  背景层      background / bgDim / bgEffect / bgHitArea
 * 020-059  角色层      player / enemy（血条、名字、状态）
 * 060-069  牌堆层      pile（左下抽牌、右下弃牌/焚牌）
 * 070-099  手牌层      handLabel / handZone / handCard
 * 100-119  HUD层       hudPlate / hudButton / hudPause
 * 120-159  卡牌交互层  cardResolving / cardHover / cardDrag
 * 160-199  舞台效果层  dropZone / targetLine / targetHint / banner
 * 200-239  通知层      toast / floatingText
 * 240-259  幽灵层      ghost（弃牌/消耗后的残影）
 * 260-299  覆盖层      overlayBg / overlayText（战斗结束遮罩）
 * 900+     菜单层      pauseMenu（永远最上层）
 */
export const DEPTH = {
  background: 0,
  bgDim: 1,
  bgEffect: 5,
  bgHitArea: 10,

  player: 30,
  playerHpBar: 31,
  playerText: 32,

  enemy: 40,
  enemyHpBar: 41,
  enemyText: 42,

  pile: 65,

  handLabel: 72,
  handZone: 76,
  handCard: 80,

  hudPlate: 100,
  hudButton: 110,
  hudPause: 115,

  cardResolving: 130,
  cardZoneTransition: 135,
  cardHover: 140,
  cardDrag: 155,

  dropZone: 160,
  targetLine: 170,
  targetHint: 175,
  banner: 180,

  toast: 200,
  floatingText: 210,
  ghost: 250,

  overlayBg: 280,
  overlayText: 290,
  flowScreenBlocker: 320,
  flowScreenBackdrop: 321,
  flowScreenContent: 330,

  pauseMenu: 900,
};
