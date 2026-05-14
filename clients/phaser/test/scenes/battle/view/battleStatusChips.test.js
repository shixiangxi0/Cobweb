import { describe, expect, it } from 'vitest';

import {
  buildStatusChipEntries,
  buildStatusChipPlan,
  createStatusChipBar,
  STATUS_CHIP_STATES,
  syncStatusChipBar,
} from '../../../../scenes/battle/view/battleStatusChips.js';

function createMockDisplayObject(type, scene, { x = 0, y = 0, text = '' } = {}) {
  return {
    type,
    scene,
    x,
    y,
    text,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    active: true,
    list: [],
    setDepth() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setSize(width, height) { this.width = width; this.height = height; return this; },
    setInteractive() { this.interactive = true; return this; },
    disableInteractive() { this.interactive = false; return this; },
    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
    setAlpha(value) { this.alpha = value; return this; },
    setScale(nextX, nextY = nextX) { this.scaleX = nextX; this.scaleY = nextY; return this; },
    setOrigin() { return this; },
    setStrokeStyle() { return this; },
    setText(value) { this.text = value; return this; },
    add(children) {
      const values = Array.isArray(children) ? children : [children];
      this.list.push(...values.filter(Boolean));
      return this;
    },
    on() { return this; },
    destroy() { this.active = false; return this; },
  };
}

function createMockGraphics(scene) {
  return {
    ...createMockDisplayObject('Graphics', scene),
    fillStyle() { return this; },
    fillRoundedRect() { return this; },
    lineStyle() { return this; },
    strokeRoundedRect() { return this; },
    lineBetween() { return this; },
    fillRect() { return this; },
    strokeRect() { return this; },
    fillTriangle() { return this; },
    fillCircle() { return this; },
    strokeCircle() { return this; },
    strokeEllipse() { return this; },
    clear() { return this; },
  };
}

function createMockScene() {
  const killedTweens = [];
  const scene = {
    _battleStatusChipTooltip: null,
    _battleStatusChipDisplayMap: {},
    W: 1440,
    H: 900,
    add: {
      container: (x = 0, y = 0) => createMockDisplayObject('Container', scene, { x, y }),
      circle: (x = 0, y = 0) => createMockDisplayObject('Circle', scene, { x, y }),
      text: (x = 0, y = 0, text = '') => createMockDisplayObject('Text', scene, { x, y, text }),
    },
    make: {
      graphics: () => createMockGraphics(scene),
    },
    tweens: {
      add(config) {
        const targets = Array.isArray(config.targets) ? config.targets : [config.targets];
        for (const target of targets.filter(Boolean)) {
          if (config.alpha != null) target.alpha = config.alpha;
          if (config.scaleX != null) target.scaleX = config.scaleX;
          if (config.scaleY != null) target.scaleY = config.scaleY;
          if (config.x != null) target.x = config.x;
          if (config.y != null) target.y = config.y;
        }
        config.onComplete?.();
        return config;
      },
      killTweensOf(target) {
        killedTweens.push(target);
      },
    },
    killedTweens,
  };
  return scene;
}

describe('battleStatusChips', () => {
  it('includes block in the shared chip stream with the highest visible priority', () => {
    const entries = buildStatusChipEntries({
      strength: { stacks: 2 },
      vulnerable: { stacks: 1 },
      block: { stacks: 7 },
    }, {}, { maxChips: 10 });

    expect(entries.map((entry) => entry.id)).toEqual(['block', 'strength', 'vulnerable']);
    expect(entries[0].stacks).toBe(7);
  });

  it('builds a diff plan for entering, updating, steady, and exiting chips', () => {
    const plan = buildStatusChipPlan(
      [
        { id: 'block', stacks: 5 },
        { id: 'strength', stacks: 2 },
        { id: 'weak', stacks: 1 },
      ],
      [
        { id: 'block', stacks: 8 },
        { id: 'strength', stacks: 2 },
        { id: 'poison', stacks: 3 },
      ],
    );

    expect(plan.entering).toEqual(['poison']);
    expect(plan.updating).toEqual(['block']);
    expect(plan.steady).toEqual(['strength']);
    expect(plan.exiting).toEqual(['weak']);
  });

  it('keeps the enter tween alive for newly created chips', () => {
    const scene = createMockScene();
    const chipBar = createStatusChipBar(scene, { maxChips: 5 });

    syncStatusChipBar(scene, chipBar, {
      extra_draw: { stacks: 2 },
    });

    const chipNode = chipBar.nodesById.get('extra_draw');

    expect(chipNode).toBeDefined();
    expect(scene.killedTweens).not.toContain(chipNode.container);
    expect(chipNode.container.alpha).toBe(1);
    expect(chipNode.container.scaleX).toBe(1);
    expect(chipNode.container.scaleY).toBe(1);
    expect(chipNode.state).toBe(STATUS_CHIP_STATES.steady);
    expect(chipBar.container.visible).toBe(true);
  });
});
