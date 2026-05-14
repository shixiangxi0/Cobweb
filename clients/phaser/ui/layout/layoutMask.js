/**
 * layoutMask.js — Phaser Container 矩形裁剪
 *
 * Phaser 原生不提供自动的 overflow:hidden 行为。
 * 这里用 GeometryMask 为 Container 添加矩形裁剪，
 * 防止子元素超出父容器边界。
 */

/**
 * 为 Container 附加一个矩形裁剪 Mask。
 * @param {Phaser.GameObjects.Container} container
 * @param {number} width   裁剪宽度（相对于 container 原点）
 * @param {number} height  裁剪高度（相对于 container 原点）
 * @param {number} [x=0]   裁剪区域中心 x（相对于 container 原点）
 * @param {number} [y=0]   裁剪区域中心 y（相对于 container 原点）
 */
export function attachRectMask(container, width, height, x = 0, y = 0) {
  const scene = container.scene;
  const graphics = scene.add.graphics({ x: 0, y: 0 });
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(x - width / 2, y - height / 2, width, height);
  graphics.setVisible(false);

  const mask = new Phaser.Display.Masks.GeometryMask(scene, graphics);
  container.setMask(mask);

  // 把 graphics 作为 container 的子元素，使其跟随 container 移动/缩放
  container.add(graphics);

  // 保存引用，方便后续更新或销毁
  if (!container.__layout) container.__layout = {};
  container.__layout.maskGraphics = graphics;
  container.__layout.mask = mask;
}

/**
 * 更新已有裁剪 Mask 的尺寸。
 * @param {Phaser.GameObjects.Container} container
 * @param {number} width
 * @param {number} height
 * @param {number} [x=0]
 * @param {number} [y=0]
 */
export function updateRectMask(container, width, height, x = 0, y = 0) {
  const layout = container?.__layout;
  const graphics = layout?.maskGraphics;
  if (!graphics) return;

  graphics.clear();
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(x - width / 2, y - height / 2, width, height);
}

/**
 * 移除裁剪 Mask。
 * @param {Phaser.GameObjects.Container} container
 */
export function removeRectMask(container) {
  const layout = container?.__layout;
  if (!layout) return;

  if (layout.mask) {
    container.clearMask();
    layout.mask.destroy();
    layout.mask = null;
  }
  if (layout.maskGraphics) {
    layout.maskGraphics.destroy();
    layout.maskGraphics = null;
  }
}
