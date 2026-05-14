/**
 * layoutUtils.js — 布局引擎工具函数
 */

/**
 * 统一 padding 为四边对象。
 * @param {number|object|null} padding
 * @returns {{top:number, right:number, bottom:number, left:number}}
 */
export function parsePadding(padding) {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  if (padding && typeof padding === 'object') {
    return {
      top: padding.top ?? 0,
      right: padding.right ?? 0,
      bottom: padding.bottom ?? 0,
      left: padding.left ?? 0,
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

/**
 * 计算去除 padding 后的内部可用空间。
 */
export function computeInnerSize(outerWidth, outerHeight, padding) {
  const p = parsePadding(padding);
  return {
    width: Math.max(0, outerWidth - p.left - p.right),
    height: Math.max(0, outerHeight - p.top - p.bottom),
  };
}

/**
 * 辅助：获取子元素的自然尺寸。
 * 优先使用子元素注册的 measure 方法，否则 fallback 到 Phaser 原生 width/height。
 */
export function getChildMeasure(child, availableWidth, availableHeight) {
  if (child?.__layout?.measure) {
    return child.__layout.measure(availableWidth, availableHeight);
  }
  return { width: child?.width ?? 0, height: child?.height ?? 0 };
}
