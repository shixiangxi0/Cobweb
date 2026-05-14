/**
 * battleStatusChips.js — 状态图标芯片系统
 *
 * 每枚芯片是 28×28 的圆角方形，内绘制矢量图标，右上角显示层数徽章。
 * 鼠标悬浮时在场景层弹出包含完整状态信息的工具提示。
 *
 * 用法：
 *   // 预加载（在 preloadBattleEnvironment 中调用）
 *   preloadStatusChipTextures(scene);
 *
 *   // 创建场景级工具提示（在 createBattleEnvironment 中调用一次）
 *   const tooltip = createStatusChipTooltip(scene);
 *   scene._battleStatusChipTooltip = tooltip;   // 存到 scene 供芯片访问
 *
 *   // 创建并挂载芯片条
 *   const chipBar = createStatusChipBar(scene, { x, y, maxChips, layout });
 *   parentContainer.add(chipBar.container);
 *
 *   // 每帧 / 状态变更时同步
 *   syncStatusChipBar(scene, chipBar, actor.statuses, statusDisplayMap);
 *
 * 新增状态：在 STATUS_CHIP_CONFIG 里追加一行。
 * 新增种类配色：在 CHIP_TONES 里追加。
 */

import { enhanceTextQuality } from '../../../ui/layout/layoutText.js';

const FONT_UI = '"Trebuchet MS", "Verdana", sans-serif';
const FONT_DISPLAY = '"Georgia", "Times New Roman", serif';

// Helper: '#80d8a0' → 0x80d8a0
function cssToInt(css) {
  return parseInt(String(css).replace(/^#/, ''), 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// 配置表
//
//   kind      — 'buff' | 'debuff' | 'reactive' | 'special'
//   priority  — 越小越靠前（空间不足时截断末尾）
//   fillHex   — 可选：覆盖 CHIP_TONES 背景色
//   strokeHex — 可选：覆盖 CHIP_TONES 边框色
//   iconColor — 可选：CSS 颜色字符串，覆盖图标绘制颜色
// ─────────────────────────────────────────────────────────────────────────────
export const STATUS_CHIP_CONFIG = {
  block:       { kind: 'guard',    priority: 5, fillHex: 0x102842, strokeHex: 0x4a7ab0, iconColor: '#a8d0f0' },
  // ── buff (绿) ────────────────────────────────────────────────
  strength:    { kind: 'buff',     priority: 10 },
  metallicize: { kind: 'buff',     priority: 15 },
  extra_draw:  { kind: 'buff',     priority: 20 },

  // ── debuff (红) ──────────────────────────────────────────────
  vulnerable:  { kind: 'debuff',   priority: 30 },
  weak:        { kind: 'debuff',   priority: 35 },
  frail:       { kind: 'debuff',   priority: 40 },
  poison:      { kind: 'debuff',   priority: 45, fillHex: 0x0e2210, strokeHex: 0x3a7430, iconColor: '#58e870' },
  card_tax:    { kind: 'debuff',   priority: 50 },

  // ── reactive (蓝) ────────────────────────────────────────────
  thorns:      { kind: 'reactive', priority: 60 },
  rupture:     { kind: 'reactive', priority: 65 },

  // ── special (紫) ─────────────────────────────────────────────
  ritual:      { kind: 'special',  priority: 70 },
  demon_form:  { kind: 'special',  priority: 75, fillHex: 0x1a0a2e, strokeHex: 0x6830a8, iconColor: '#d080ff' },
};

// ─────────────────────────────────────────────────────────────────────────────
// 配色方案
//   fill   — 背景填充
//   stroke — 外边框
//   text   — 图标默认颜色（CSS）
//   badge  — 层数徽章背景
// ─────────────────────────────────────────────────────────────────────────────
export const CHIP_TONES = {
  guard:    { fill: 0x102842, stroke: 0x4a7ab0, text: '#a8d0f0', badge: 0x183a60 },
  buff:     { fill: 0x0c2018, stroke: 0x387050, text: '#80d8a0', badge: 0x205038 },
  debuff:   { fill: 0x260c0c, stroke: 0x7e3030, text: '#e89090', badge: 0x561e1e },
  reactive: { fill: 0x0a2028, stroke: 0x2a6070, text: '#78c8d8', badge: 0x1c4050 },
  special:  { fill: 0x160a26, stroke: 0x583898, text: '#a888d8', badge: 0x321860 },
};

export const CHIP_SIZE = 28;
export const CHIP_GAP  = 4;

const TOOLTIP_W = 228;

export const STATUS_CHIP_STATES = Object.freeze({
  entering: 'entering',
  steady: 'steady',
  updating: 'updating',
  exiting: 'exiting',
});

const CHIP_MOTION = Object.freeze({
  enter: 140,
  update: 120,
  move: 120,
  exit: 110,
});

// ─────────────────────────────────────────────────────────────────────────────
// 预加载钩子
// 图标目前以矢量方式实时绘制，不需要外部纹理资产。
// 此函数是扩展预留点，未来接入精灵图时在此加载。
// ─────────────────────────────────────────────────────────────────────────────
export function preloadStatusChipTextures(_scene) {}

// ─────────────────────────────────────────────────────────────────────────────
// 悬浮工具提示（场景级，一份实例全局共享）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 在场景层创建工具提示容器。深度 200，始终在芯片之上。
 * 调用方负责将返回值存储到 scene._battleStatusChipTooltip。
 */
export function createStatusChipTooltip(scene) {
  const container = scene.add.container(0, 0).setDepth(200).setVisible(false);

  const bg = scene.add.graphics();

  const nameText = scene.add.text(12, 9, '', {
    fontFamily: FONT_DISPLAY,
    fontSize: '14px',
    color: '#f0e0c0',
    fontStyle: 'bold',
  }).setOrigin(0, 0);
  enhanceTextQuality(nameText, {
    style: { fontFamily: FONT_DISPLAY, fontSize: '14px' },
    shadowColor: 'rgba(8, 5, 3, 0.22)',
  });

  // 分隔线位置 y=27 (由 bg 绘制)

  const stackRow = scene.add.text(12, 32, '', {
    fontFamily: FONT_UI,
    fontSize: '11px',
    color: '#b8a070',
  }).setOrigin(0, 0);
  enhanceTextQuality(stackRow, {
    style: { fontFamily: FONT_UI, fontSize: '11px' },
    shadowColor: 'rgba(0, 0, 0, 0.16)',
  });

  const descText = scene.add.text(12, 48, '', {
    fontFamily: FONT_UI,
    fontSize: '12px',
    color: '#c8b090',
    wordWrap: { width: TOOLTIP_W - 24 },
    lineSpacing: 2,
  }).setOrigin(0, 0);
  enhanceTextQuality(descText, {
    mode: 'multi',
    style: { fontFamily: FONT_UI, fontSize: '12px' },
    shadowColor: 'rgba(0, 0, 0, 0.14)',
  });

  container.add([bg, nameText, stackRow, descText]);
  return { container, bg, nameText, stackRow, descText };
}

/**
 * 显示工具提示并定位到光标旁。
 * sceneW / sceneH 用于屏幕夹紧，避免超出边界。
 */
export function showStatusChipTooltip(tooltip, worldX, worldY, id, stacks, displayMap, sceneW, sceneH) {
  if (!tooltip?.container?.active) return;
  const { container, bg, nameText, stackRow, descText } = tooltip;

  const name = displayMap?.[id]?.name ?? id;
  const desc = displayMap?.[id]?.desc ?? '';

  nameText.setText(name);
  stackRow.setText(`×${stacks} 层`);
  descText.setText(desc);

  // 背景高度由描述文本撑开
  const descH = Math.max(descText.height, 12);
  const totalH = 56 + descH + 10;

  bg.clear();
  // 底板
  bg.fillStyle(0x0e0a06, 0.97);
  bg.fillRoundedRect(0, 0, TOOLTIP_W, totalH, 8);
  // 外边框
  bg.lineStyle(1.5, 0x7a5c38, 0.9);
  bg.strokeRoundedRect(0, 0, TOOLTIP_W, totalH, 8);
  // 标题分隔线
  bg.lineStyle(1, 0xb08040, 0.35);
  bg.lineBetween(12, 27, TOOLTIP_W - 12, 27);

  // 定位：光标右偏，夹紧屏幕边界
  const sw = sceneW ?? 1440;
  const sh = sceneH ?? 900;
  const tx = Math.min(worldX + 18, sw - TOOLTIP_W - 8);
  const ty = Math.max(8, Math.min(worldY - Math.round(totalH / 2), sh - totalH - 8));

  container.setPosition(tx, ty).setVisible(true);
}

export function hideStatusChipTooltip(tooltip) {
  tooltip?.container?.setVisible(false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 矢量图标绘制
// 所有图标绘制在 ±9px 区域内（以 0,0 为中心）。
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line complexity
function drawStatusIconMotif(g, id, color) {
  g.lineStyle(2, color, 0.92);
  g.fillStyle(color, 0.88);

  switch (id) {
    case 'block': {
      g.fillStyle(color, 0.24);
      g.fillRect(-6, -8, 12, 9);
      g.fillTriangle(-6, 1, 6, 1, 0, 9);
      g.lineStyle(2, color, 0.92);
      g.strokeRect(-6, -8, 12, 9);
      g.lineBetween(-6, 1, 0, 9);
      g.lineBetween(6, 1, 0, 9);
      g.lineStyle(1.5, color, 0.88);
      g.lineBetween(-2, -3, 2, -3);
      g.lineBetween(-1, 0, 1, 0);
      break;
    }
    // ── buff ──────────────────────────────────────────────────────────────
    case 'strength': {
      // 向上实心箭头 + 梗部
      g.fillTriangle(-5, 1, 5, 1, 0, -8);
      g.lineStyle(2.5, color, 0.92);
      g.lineBetween(0, 1, 0, 8);
      break;
    }
    case 'metallicize': {
      // 盾形：矩形顶部 + 尖底
      g.fillStyle(color, 0.28);
      g.fillRect(-6, -8, 12, 9);
      g.fillTriangle(-6, 1, 6, 1, 0, 9);
      g.lineStyle(2, color, 0.92);
      g.strokeRect(-6, -8, 12, 9);
      g.lineBetween(-6, 1, 0, 9);
      g.lineBetween(6, 1, 0, 9);
      // 盾面横线
      g.lineStyle(1, color, 0.48);
      g.lineBetween(-3, -2, 3, -2);
      break;
    }
    case 'extra_draw': {
      // 两张叠放的小牌
      g.lineStyle(1.5, color, 0.5);
      g.fillStyle(color, 0.14);
      g.fillRect(-7, -1, 9, 10);
      g.strokeRect(-7, -1, 9, 10);
      g.lineStyle(1.5, color, 0.92);
      g.fillStyle(color, 0.28);
      g.fillRect(-2, -8, 9, 10);
      g.strokeRect(-2, -8, 9, 10);
      // 牌面横线装饰
      g.lineStyle(1, color, 0.4);
      g.lineBetween(-1, -5, 6, -5);
      break;
    }
    // ── debuff ────────────────────────────────────────────────────────────
    case 'vulnerable': {
      // 朝下的 V — 表示防御被击穿
      g.lineStyle(2.5, color, 0.92);
      g.lineBetween(-7, -5, 0, 5);
      g.lineBetween(7, -5, 0, 5);
      // 顶部裂缝线
      g.lineStyle(1.5, color, 0.65);
      g.lineBetween(-4, -9, -1, -5);
      g.lineBetween(4, -9, 1, -5);
      break;
    }
    case 'weak': {
      // 向下箭头（力量的镜像）
      g.fillTriangle(-5, -1, 5, -1, 0, 9);
      g.lineStyle(2.5, color, 0.92);
      g.lineBetween(0, -9, 0, -1);
      break;
    }
    case 'frail': {
      // 两段断裂的括号 — 结构失效
      g.lineStyle(2, color, 0.92);
      g.lineBetween(-7, -8, -7, -1);
      g.lineBetween(-7, -8, -3, -8);
      g.lineBetween(7, 1, 7, 8);
      g.lineBetween(7, 8, 3, 8);
      // 断口连线（低透明度）
      g.lineStyle(1, color, 0.4);
      g.lineBetween(-6, 0, -2, -1);
      g.lineBetween(2, 1, 6, 0);
      break;
    }
    case 'poison': {
      // 泪滴：圆形顶端 + 尖底
      g.fillStyle(color, 0.88);
      g.fillCircle(0, -2, 5);
      g.fillTriangle(-5, -2, 5, -2, 0, 9);
      g.lineStyle(2, color, 0.92);
      g.strokeCircle(0, -2, 5);
      break;
    }
    case 'card_tax': {
      // 两个互扣的链节椭圆
      g.lineStyle(2, color, 0.92);
      g.strokeEllipse(-1, -3, 9, 12);
      g.strokeEllipse(1, 3, 9, 12);
      break;
    }
    // ── reactive ──────────────────────────────────────────────────────────
    case 'thorns': {
      // 6 辐星形爆发
      g.lineStyle(2, color, 0.92);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        g.lineBetween(0, 0, Math.cos(a) * 8, Math.sin(a) * 8);
      }
      g.fillStyle(color, 0.95);
      g.fillCircle(0, 0, 2.5);
      break;
    }
    case 'rupture': {
      // 菱形轮廓 + 闪电裂纹
      g.lineStyle(2, color, 0.92);
      g.lineBetween(0, -9, 7, 0);
      g.lineBetween(7, 0, 0, 9);
      g.lineBetween(0, 9, -7, 0);
      g.lineBetween(-7, 0, 0, -9);
      g.lineStyle(2, color, 0.7);
      g.lineBetween(1, -9, 3, -2);
      g.lineBetween(3, -2, -1, 2);
      g.lineBetween(-1, 2, 1, 9);
      break;
    }
    // ── special ───────────────────────────────────────────────────────────
    case 'ritual': {
      // 五角星阵列（五角星线 + 圆点）
      g.lineStyle(1, color, 0.38);
      for (let i = 0; i < 5; i += 1) {
        const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineBetween(
          Math.cos(a1) * 7, Math.sin(a1) * 7,
          Math.cos(a2) * 7, Math.sin(a2) * 7,
        );
      }
      g.fillStyle(color, 0.92);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillCircle(Math.cos(a) * 7, Math.sin(a) * 7, 2.5);
      }
      break;
    }
    case 'demon_form': {
      // 三齿皇冠
      g.fillStyle(color, 0.88);
      g.fillRect(-7, 2, 14, 5);             // 冠体底座
      g.fillTriangle(-7, 2, -3, 2, -5, -7); // 左齿
      g.fillTriangle(-2.5, 2, 2.5, 2, 0, -9); // 中齿（最高）
      g.fillTriangle(3, 2, 7, 2, 5, -7);    // 右齿
      g.lineStyle(2, color, 0.92);
      g.strokeRect(-7, 2, 14, 5);
      g.lineBetween(-7, 2, -5, -7);
      g.lineBetween(-3, 2, -5, -7);
      g.lineBetween(-2.5, 2, 0, -9);
      g.lineBetween(2.5, 2, 0, -9);
      g.lineBetween(3, 2, 5, -7);
      g.lineBetween(7, 2, 5, -7);
      break;
    }
    default: {
      // 后备：实心菱形
      g.fillStyle(color, 0.75);
      g.fillTriangle(-7, 0, 0, -8, 7, 0);
      g.fillTriangle(-7, 0, 7, 0, 0, 8);
      g.lineStyle(2, color, 0.92);
      g.lineBetween(0, -8, 7, 0);
      g.lineBetween(7, 0, 0, 8);
      g.lineBetween(0, 8, -7, 0);
      g.lineBetween(-7, 0, 0, -8);
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 内部条目解析
// ─────────────────────────────────────────────────────────────────────────────

function resolveStatusEntry(id, info, displayMap) {
  const cfg = STATUS_CHIP_CONFIG[id] ?? null;
  const kind = cfg?.kind ?? 'special';
  const tone = CHIP_TONES[kind] ?? CHIP_TONES.special;
  return {
    id,
    stacks: info?.stacks ?? 0,
    kind,
    priority: cfg?.priority ?? 999,
    fillHex: cfg?.fillHex ?? null,
    strokeHex: cfg?.strokeHex ?? null,
    iconColor: cfg?.iconColor ? cssToInt(cfg.iconColor) : cssToInt(tone.text),
    tone,
  };
}

export function buildStatusChipEntries(statuses = {}, displayMap = {}, { maxChips = Infinity } = {}) {
  return Object.entries(statuses)
    .filter(([, info]) => (info?.stacks ?? 0) > 0)
    .map(([id, info]) => resolveStatusEntry(id, info, displayMap))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxChips);
}

export function buildStatusChipPlan(previousEntries = [], nextEntries = []) {
  const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  const nextById = new Map(nextEntries.map((entry) => [entry.id, entry]));

  return {
    entering: nextEntries.filter((entry) => !previousById.has(entry.id)).map((entry) => entry.id),
    updating: nextEntries.filter((entry) => {
      const previous = previousById.get(entry.id);
      return previous && previous.stacks !== entry.stacks;
    }).map((entry) => entry.id),
    steady: nextEntries.filter((entry) => {
      const previous = previousById.get(entry.id);
      return previous && previous.stacks === entry.stacks;
    }).map((entry) => entry.id),
    exiting: previousEntries.filter((entry) => !nextById.has(entry.id)).map((entry) => entry.id),
  };
}

function buildChipBackground(scene, entry) {
  const { tone, fillHex, strokeHex } = entry;
  const fill   = fillHex   ?? tone.fill;
  const stroke = strokeHex ?? tone.stroke;
  const half   = CHIP_SIZE / 2;

  const g = scene.make.graphics({ add: false });
  g.fillStyle(fill, 0.96);
  g.fillRoundedRect(-half, -half, CHIP_SIZE, CHIP_SIZE, 6);
  g.lineStyle(1.5, stroke, 0.92);
  g.strokeRoundedRect(-half, -half, CHIP_SIZE, CHIP_SIZE, 6);
  // 顶部高光（烛光折射）
  g.lineStyle(1, 0xffffff, 0.1);
  g.lineBetween(-half + 6, -half + 2, half - 6, -half + 2);
  return g;
}

function createChipNode(scene, entry, tooltip) {
  const { tone } = entry;
  const half = CHIP_SIZE / 2;

  // 使容器可接受指针事件（Phaser 3 中 Container 需先 setSize 才能 setInteractive）
  const chipContainer = scene.add.container(0, 0)
    .setSize(CHIP_SIZE, CHIP_SIZE)
    .setInteractive({ useHandCursor: false });

  // 底板
  chipContainer.add(buildChipBackground(scene, entry));

  // 矢量图标
  const iconG = scene.make.graphics({ add: false });
  drawStatusIconMotif(iconG, entry.id, entry.iconColor);
  chipContainer.add(iconG);

  // 层数徽章（始终显示）
  const badgeCx = half - 2;
  const badgeCy = -half + 2;
  const badgeBg = scene.add.circle(badgeCx, badgeCy, 7, tone.badge, 1)
    .setStrokeStyle(1, 0x010101, 0.55);
  const badgeText = scene.add.text(badgeCx, badgeCy, String(entry.stacks), {
    fontFamily: FONT_UI,
    fontSize: '9px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  chipContainer.add([badgeBg, badgeText]);

  // 悬浮工具提示
  if (tooltip) {
    chipContainer.on('pointerover', (pointer) => {
      showStatusChipTooltip(
        tooltip,
        pointer.worldX,
        pointer.worldY,
        entry.id,
        entry.stacks,
        scene._battleStatusChipDisplayMap ?? {},
        scene.W,
        scene.H,
      );
    });
    chipContainer.on('pointerout', () => hideStatusChipTooltip(tooltip));
  }

  return {
    id: entry.id,
    stacks: entry.stacks,
    state: STATUS_CHIP_STATES.entering,
    container: chipContainer,
    badgeBg,
    badgeText,
  };
}

function setChipNodeState(chipNode, state) {
  if (!chipNode || !state) return chipNode;
  chipNode.state = state;
  return chipNode;
}

function resolveChipPosition(chipBar, index, total) {
  const step = CHIP_SIZE + CHIP_GAP;
  return {
    x: chipBar.layout === 'horizontal'
      ? index * step - ((total - 1) * step) / 2
      : 0,
    y: chipBar.layout === 'vertical' ? index * step : 0,
  };
}

function moveChipNode(scene, chipNode, position, { immediate = false } = {}) {
  if (!scene || !chipNode?.container?.active || !position) return;

  scene.tweens.killTweensOf(chipNode.container);
  if (immediate) {
    chipNode.container.setPosition(position.x, position.y);
    return;
  }

  scene.tweens.add({
    targets: chipNode.container,
    x: position.x,
    y: position.y,
    duration: CHIP_MOTION.move,
    ease: 'Cubic.Out',
  });
}

function animateChipEnter(scene, chipNode) {
  if (!scene || !chipNode?.container?.active) return;

  setChipNodeState(chipNode, STATUS_CHIP_STATES.entering);
  chipNode.container.setAlpha(0).setScale(0.72);
  scene.tweens.add({
    targets: chipNode.container,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: CHIP_MOTION.enter,
    ease: 'Back.Out',
    onComplete: () => setChipNodeState(chipNode, STATUS_CHIP_STATES.steady),
  });
}

function animateChipUpdate(scene, chipNode, entry) {
  if (!scene || !chipNode?.container?.active) return;

  chipNode.stacks = entry.stacks;
  chipNode.badgeText?.setText(String(entry.stacks));
  setChipNodeState(chipNode, STATUS_CHIP_STATES.updating);

  scene.tweens.killTweensOf(chipNode.badgeBg);
  scene.tweens.killTweensOf(chipNode.badgeText);

  scene.tweens.add({
    targets: chipNode.container,
    scaleX: 1.1,
    scaleY: 1.1,
    duration: CHIP_MOTION.update,
    ease: 'Quad.Out',
    yoyo: true,
    onComplete: () => setChipNodeState(chipNode, STATUS_CHIP_STATES.steady),
  });
  scene.tweens.add({
    targets: [chipNode.badgeBg, chipNode.badgeText].filter(Boolean),
    scaleX: 1.12,
    scaleY: 1.12,
    duration: CHIP_MOTION.update,
    ease: 'Quad.Out',
    yoyo: true,
  });
}

function animateChipExit(scene, chipBar, chipNode) {
  if (!scene || !chipBar || !chipNode?.container?.active) return;

  setChipNodeState(chipNode, STATUS_CHIP_STATES.exiting);
  hideStatusChipTooltip(chipBar.tooltip);
  chipNode.container.disableInteractive?.();
  scene.tweens.killTweensOf(chipNode.container);
  scene.tweens.add({
    targets: chipNode.container,
    alpha: 0,
    scaleX: 0.74,
    scaleY: 0.74,
    duration: CHIP_MOTION.exit,
    ease: 'Quad.In',
    onComplete: () => {
      chipBar.nodesById.delete(chipNode.id);
      chipNode.container.destroy();
      chipBar.container.setVisible(chipBar.nodesById.size > 0);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建状态芯片条。`container` 子节点需由调用方挂载到父容器。
 *
 * @param {Phaser.Scene} scene
 * @param {{ x, y, maxChips, layout, depth }} options
 */
export function createStatusChipBar(scene, {
  x = 0,
  y = 0,
  maxChips = 5,
  layout = 'horizontal',
  depth = 14,
} = {}) {
  const tooltip = scene?._battleStatusChipTooltip ?? null;
  const container = scene.add.container(x, y).setDepth(depth).setVisible(false);
  return {
    container,
    maxChips,
    layout,
    depth,
    tooltip,
    nodesById: new Map(),
  };
}

/**
 * 将芯片条同步到当前 statuses 数据。
 * 签名未变化时跳过重建，减少 GC 压力。
 *
 * @param {Phaser.Scene} scene
 * @param {object} chipBar      createStatusChipBar 返回值
 * @param {object} statuses     { strength: { stacks: 2 }, ... }
 * @param {object} displayMap   statusDisplayMap（来自 presenter）
 */
export function syncStatusChipBar(scene, chipBar, statuses = {}, displayMap = {}) {
  if (!chipBar?.container?.active || !scene) return;

  // 缓存 displayMap 供工具提示读取
  scene._battleStatusChipDisplayMap = displayMap;

  const entries = buildStatusChipEntries(statuses, displayMap, { maxChips: chipBar.maxChips });
  const previousEntries = Array.from(chipBar.nodesById.values()).map((chipNode) => ({
    id: chipNode.id,
    stacks: chipNode.stacks,
  }));
  const plan = buildStatusChipPlan(previousEntries, entries);
  const updatingIds = new Set(plan.updating);

  for (const id of plan.exiting) {
    const chipNode = chipBar.nodesById.get(id);
    if (chipNode) {
      animateChipExit(scene, chipBar, chipNode);
    }
  }

  entries.forEach((entry, index) => {
    let chipNode = chipBar.nodesById.get(entry.id) ?? null;
    const position = resolveChipPosition(chipBar, index, entries.length);

    if (!chipNode) {
      chipNode = createChipNode(scene, entry, chipBar.tooltip);
      chipNode.container.setPosition(position.x, position.y);
      chipBar.nodesById.set(entry.id, chipNode);
      chipBar.container.add(chipNode.container);
      animateChipEnter(scene, chipNode);
    } else {
      moveChipNode(scene, chipNode, position, { immediate: false });
      if (updatingIds.has(entry.id)) {
        animateChipUpdate(scene, chipNode, entry);
      } else if (chipNode.state !== STATUS_CHIP_STATES.exiting) {
        chipNode.stacks = entry.stacks;
        chipNode.badgeText?.setText(String(entry.stacks));
        setChipNodeState(chipNode, STATUS_CHIP_STATES.steady);
      }
    }
  });

  chipBar.container.setVisible(entries.length > 0 || chipBar.nodesById.size > 0);
}

