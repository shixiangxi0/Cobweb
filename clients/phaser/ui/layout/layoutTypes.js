/**
 * layoutTypes.js — 布局策略：overlay / vbox / hbox
 *
 * 每个策略导出 measure* 和 arrange* 两个纯函数。
 * measure：在可用空间内计算自然尺寸
 * arrange：在已分配空间内排列子元素
 */

import { parsePadding, computeInnerSize, getChildMeasure } from './layoutUtils.js';

// ── overlay：保持现有绝对定位行为，只计算包围盒 ─────────────────────────────

export function measureOverlay(layout, children, availableWidth, availableHeight) {
  let maxW = 0;
  let maxH = 0;
  for (const child of children) {
    const size = getChildMeasure(child, availableWidth, availableHeight);
    maxW = Math.max(maxW, size.width);
    maxH = Math.max(maxH, size.height);
  }
  return { width: maxW, height: maxH };
}

export function arrangeOverlay(_layout, _children, _x, _y, _width, _height) {
  // overlay 的子元素已有自己的绝对坐标，无需重新排列
}

// ── vbox：垂直堆叠，gap 控制间距 ───────────────────────────────────────────

export function measureVBox(layout, children, availableWidth, availableHeight) {
  const { padding, gap } = layout;
  const inner = computeInnerSize(availableWidth, availableHeight, padding);
  let totalH = 0;
  let maxW = 0;
  for (const child of children) {
    const size = getChildMeasure(child, inner.width, Infinity);
    totalH += size.height;
    maxW = Math.max(maxW, size.width);
  }
  if (children.length > 1) totalH += (children.length - 1) * gap;
  return {
    width: maxW + padding.left + padding.right,
    height: totalH + padding.top + padding.bottom,
  };
}

export function arrangeVBox(layout, children, _x, _y, width, height) {
  const { padding, gap, align } = layout;
  const inner = computeInnerSize(width, height, padding);

  const sizes = children.map((c) => getChildMeasure(c, inner.width, Infinity));
  let currentY = -inner.height / 2 + padding.top;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const size = sizes[i];

    let cx = 0;
    if (align === 'start') cx = -inner.width / 2 + size.width / 2;
    else if (align === 'center') cx = 0;
    else if (align === 'end') cx = inner.width / 2 - size.width / 2;
    else if (align === 'stretch') cx = 0;

    child.setPosition(cx, currentY + size.height / 2);
    currentY += size.height + gap;
  }
}

// ── hbox：水平排列，gap 控制间距 ───────────────────────────────────────────

export function measureHBox(layout, children, availableWidth, availableHeight) {
  const { padding, gap } = layout;
  const inner = computeInnerSize(availableWidth, availableHeight, padding);
  let totalW = 0;
  let maxH = 0;
  for (const child of children) {
    const size = getChildMeasure(child, Infinity, inner.height);
    totalW += size.width;
    maxH = Math.max(maxH, size.height);
  }
  if (children.length > 1) totalW += (children.length - 1) * gap;
  return {
    width: totalW + padding.left + padding.right,
    height: maxH + padding.top + padding.bottom,
  };
}

export function arrangeHBox(layout, children, _x, _y, width, height) {
  const { padding, gap, align } = layout;
  const inner = computeInnerSize(width, height, padding);

  const sizes = children.map((c) => getChildMeasure(c, Infinity, inner.height));
  let currentX = -inner.width / 2 + padding.left;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const size = sizes[i];

    let cy = 0;
    if (align === 'start') cy = -inner.height / 2 + size.height / 2;
    else if (align === 'center') cy = 0;
    else if (align === 'end') cy = inner.height / 2 - size.height / 2;

    child.setPosition(currentX + size.width / 2, cy);
    currentX += size.width + gap;
  }
}
