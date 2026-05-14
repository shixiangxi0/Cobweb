import {
  createGame,
  RENDERER_AUTO,
  SCALE_CENTER_BOTH,
  SCALE_MODE_RESIZE,
} from './phaserCompat.js';
import { BattleScene } from '../scenes/battle/battleScene.js';
import { RewardScene } from '../scenes/reward/rewardScene.js';
import { ShopScene } from '../scenes/shop/shopScene.js';

function resolveDeviceResolution() {
  return Math.max(1, window.devicePixelRatio || 1);
}

function installDefaultTextResolution(resolution) {
  const factory = globalThis.Phaser?.GameObjects?.GameObjectFactory?.prototype;
  if (!factory || factory.__cobwebTextResolutionPatched) return;

  const originalText = factory.text;
  if (typeof originalText !== 'function') return;

  factory.text = function patchedText(x, y, text, style) {
    const nextStyle = style?.resolution == null
      ? { ...(style ?? {}), resolution }
      : style;
    return originalText.call(this, x, y, text, nextStyle);
  };

  factory.__cobwebTextResolutionPatched = true;
}

async function loadDragonBonesScenePlugin() {
  const plugin = globalThis.dragonBones?.phaser?.plugin?.DragonBonesScenePlugin;
  if (plugin) return plugin;

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/dragonBones.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load DragonBones runtime.'));
    document.head.appendChild(script);
  });

  return globalThis.dragonBones?.phaser?.plugin?.DragonBonesScenePlugin ?? null;
}

const deviceResolution = resolveDeviceResolution();
installDefaultTextResolution(deviceResolution);
const dragonBonesScenePlugin = await loadDragonBonesScenePlugin();

if (typeof window !== 'undefined') {
  window.__battleHelp = [
    'Phaser debug mode:',
    '  append ?debug-ui=1 to the URL to show named bounds',
    '  F8 toggles debug bounds',
    '  F9 prints named objects to the console',
    '  window.__battleDebug.list()',
    '  window.__battleDebug.pickAt(x, y)',
    "  window.__battleDebug.enableInputDebug('player.container')",
  ].join('\n');
}

const game = createGame({
  type: RENDERER_AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: deviceResolution,
  autoRound: false,
  backgroundColor: '#f6f2ea',
  scene: [BattleScene, RewardScene, ShopScene],
  scale: {
    mode: SCALE_MODE_RESIZE,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  plugins: {
    scene: dragonBonesScenePlugin
      ? [
        {
          key: 'dragonbone',
          plugin: dragonBonesScenePlugin,
          mapping: 'dragonbone',
        },
      ]
      : [],
  },
});

// Phaser 3.90 的 ScaleManager 在 RESIZE 模式下不会把 canvas backing store 乘上 DPR，
// 导致高 DPI 屏幕上浏览器强制 upscale 而全局模糊。
// 这里在每帧渲染前强制同步 canvas 的物理像素尺寸与 CSS 尺寸 × DPR。
function fixCanvasDpr() {
  const canvas = game.canvas;
  if (!canvas) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = Math.round(canvas.clientWidth);
  const cssH = Math.round(canvas.clientHeight);
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    if (game.renderer && typeof game.renderer.resize === 'function') {
      game.renderer.resize(targetW, targetH);
    }
  }
}

// prestep 在 Phaser 每帧逻辑更新之前触发，确保渲染前 viewport 已修正
if (game.events) {
  game.events.on('prestep', fixCanvasDpr);
}

