/**
 * layoutText.js — 带约束的文本组件
 *
 * 将 battleText.js 的 fitSingleLineText / fitParagraphText 封装进布局协议，
 * 使文本节点能在 measure 阶段自动根据可用空间完成适配。
 */

import { fitSingleLineText, fitParagraphText } from '../../scenes/battle/view/battleText.js';

function parseFontSize(fontSize, fallback = 16) {
  if (Number.isFinite(fontSize)) return fontSize;
  const match = /-?\d+(?:\.\d+)?/.exec(String(fontSize ?? ''));
  return match ? Number(match[0]) : fallback;
}

function resolveTextResolution() {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, window.devicePixelRatio || 1);
}

export function enhanceTextQuality(node, {
  mode = 'single',
  style = {},
  shadowColor = null,
} = {}) {
  if (!node) return node;

  const fontFamily = String(style.fontFamily ?? node.style?.fontFamily ?? '');
  const fontSize = parseFontSize(style.fontSize ?? node.style?.fontSize, 16);
  const isDisplay = /Georgia|Times/i.test(fontFamily);
  const resolvedShadow = shadowColor ?? (isDisplay
    ? 'rgba(18, 12, 8, 0.22)'
    : 'rgba(0, 0, 0, 0.18)');

  const resolution = Number.isFinite(style.resolution) && style.resolution > 0
    ? style.resolution
    : resolveTextResolution();

  node.setResolution?.(resolution);
  node.setPadding?.(2, 2, 2, mode === 'multi' ? 4 : 3);

  if (!style.shadow) {
    node.setShadow?.(
      0,
      Math.max(1, Math.round(fontSize * 0.06)),
      resolvedShadow,
      Math.max(2, Math.round(fontSize * 0.14)),
      false,
      true,
    );
  }

  if (mode === 'multi' && (node.lineSpacing ?? 0) < 2) {
    node.setLineSpacing?.(2);
  }

  return node;
}

/**
 * @param {Phaser.Scene} scene
 * @param {string} text
 * @param {object} [options]
 * @param {object} [options.style]          Phaser text style（fontSize, color 等）
 * @param {object} [options.constraints]    { maxWidth, maxHeight, maxLines, minFontSize, ellipsis }
 * @param {'single'|'multi'} [options.mode='single']
 */
export function createLayoutText(scene, text, {
  style = {},
  constraints = {},
  mode = 'single',
} = {}) {
  const node = scene.add.text(0, 0, text, style);
  enhanceTextQuality(node, { mode, style });

  node.__layout = {
    type: 'text',
    mode,
    constraints,

    /**
     * measure 在布局引擎计算自然尺寸时调用。
     * 可用空间（availableWidth/Height）若未显式指定 maxWidth/maxHeight，则自动继承。
     */
    measure(availableWidth, availableHeight) {
      const currentText = node.text ?? '';
      const opts = {
        maxWidth: Number.isFinite(this.constraints.maxWidth)
          ? this.constraints.maxWidth
          : (Number.isFinite(availableWidth) ? availableWidth : undefined),
        maxHeight: Number.isFinite(this.constraints.maxHeight)
          ? this.constraints.maxHeight
          : (Number.isFinite(availableHeight) ? availableHeight : undefined),
        maxLines: this.constraints.maxLines,
        minFontSize: this.constraints.minFontSize,
        ellipsis: this.constraints.ellipsis ?? '...',
      };

      if (this.mode === 'single') {
        fitSingleLineText(node, currentText, opts);
      } else {
        fitParagraphText(node, currentText, opts);
      }

      return { width: node.width, height: node.height };
    },
  };

  // 初始测量（无约束，获取自然尺寸）
  node.__layout.measure(Infinity, Infinity);

  return node;
}
