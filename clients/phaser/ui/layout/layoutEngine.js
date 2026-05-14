/**
 * layoutEngine.js — 轻量布局引擎核心
 *
 * 在 Phaser Container 上附加 __layout 元数据，劫持 add() 自动注册子节点，
 * 提供 Measure → Arrange 两阶段布局协议。
 */

import { parsePadding } from './layoutUtils.js';
import * as layoutTypes from './layoutTypes.js';

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 给 Phaser Container 附加布局能力。
 * @param {Phaser.GameObjects.Container} container
 * @param {object} [options]
 * @param {string} [options.type='overlay']  'overlay' | 'vbox' | 'hbox'
 * @param {number|object} [options.padding=0]
 * @param {number} [options.gap=0]
 * @param {string} [options.align='start']  'start' | 'center' | 'end' | 'stretch'
 * @param {string} [options.justify='start']
 */
export function attachLayout(container, options = {}) {
  const layout = {
    type: options.type ?? 'overlay',
    padding: parsePadding(options.padding),
    gap: options.gap ?? 0,
    align: options.align ?? 'start',
    justify: options.justify ?? 'start',
    children: [],
    measuredWidth: 0,
    measuredHeight: 0,
    allocatedX: 0,
    allocatedY: 0,
    allocatedWidth: 0,
    allocatedHeight: 0,
    dirty: true,
  };

  container.__layout = layout;

  // Hook container.add，让后续 add() 自动注册到 layout.children
  const originalAdd = container.add.bind(container);
  container.add = function addWithLayout(...args) {
    const result = originalAdd(...args);
    const flat = args.flat();
    for (const child of flat) {
      if (child && typeof child === 'object') {
        if (!child.__layout) child.__layout = { type: 'leaf' };
        if (!layout.children.includes(child)) layout.children.push(child);
      }
    }
    return result;
  };

  // 注册已存在的子元素
  for (const child of container.list || []) {
    if (!child.__layout) child.__layout = { type: 'leaf' };
    if (!layout.children.includes(child)) layout.children.push(child);
  }

  return container;
}

/**
 * 测量节点的自然尺寸。
 * @param {Phaser.GameObjects.GameObject} node
 * @param {number} [availableWidth=Infinity]
 * @param {number} [availableHeight=Infinity]
 * @returns {{width:number, height:number}}
 */
export function measureLayout(node, availableWidth = Infinity, availableHeight = Infinity) {
  if (!node?.__layout) {
    return { width: node?.width ?? 0, height: node?.height ?? 0 };
  }

  const layout = node.__layout;

  // 文本节点或自定义 measure
  if (typeof layout.measure === 'function') {
    const size = layout.measure(availableWidth, availableHeight);
    layout.measuredWidth = size.width;
    layout.measuredHeight = size.height;
    layout.dirty = false;
    return size;
  }

  // 叶子节点直接读 Phaser 尺寸
  if (layout.type === 'leaf') {
    const size = { width: node.width ?? 0, height: node.height ?? 0 };
    layout.measuredWidth = size.width;
    layout.measuredHeight = size.height;
    layout.dirty = false;
    return size;
  }

  // 容器节点走策略
  const measureFn = layoutTypes[`measure${capitalize(layout.type)}`];
  if (measureFn) {
    const size = measureFn(layout, layout.children, availableWidth, availableHeight);
    layout.measuredWidth = size.width;
    layout.measuredHeight = size.height;
    layout.dirty = false;
    return size;
  }

  // fallback
  const size = { width: node.width ?? 0, height: node.height ?? 0 };
  layout.measuredWidth = size.width;
  layout.measuredHeight = size.height;
  layout.dirty = false;
  return size;
}

/**
 * 在已分配空间内排列节点及其子节点。
 * @param {Phaser.GameObjects.GameObject} node
 * @param {number} [x=0]
 * @param {number} [y=0]
 * @param {number} [width]
 * @param {number} [height]
 */
export function arrangeLayout(node, x = 0, y = 0, width, height) {
  if (!node?.__layout) return;

  const layout = node.__layout;
  layout.allocatedX = x;
  layout.allocatedY = y;
  layout.allocatedWidth = width ?? layout.measuredWidth;
  layout.allocatedHeight = height ?? layout.measuredHeight;

  const arrangeFn = layoutTypes[`arrange${capitalize(layout.type)}`];
  if (arrangeFn) {
    arrangeFn(layout, layout.children, x, y, layout.allocatedWidth, layout.allocatedHeight);
  }
}

/**
 * 标记节点及其父链为 dirty，等待下次 relayout。
 * （当前版本为简化未实现自动 relayout，需手动调用 arrangeLayout）
 */
export function invalidateLayout(node) {
  if (node?.__layout) node.__layout.dirty = true;
}
