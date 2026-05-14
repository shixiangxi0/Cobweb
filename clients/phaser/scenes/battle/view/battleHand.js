import { CARD_UI, TIMING } from '../../../src/constants.js';
import {
  CARD_STATES,
  canTransitionCardState,
  isHandCardState,
  isRaisedCardState,
  isTransientCardState,
  isZoneTransitionCardState,
} from '../state/battleCardState.js';
import { BATTLE_MODES } from '../state/battleModeState.js';
import {
  assignCardNodeDebugNames,
  cardPoseForState,
  createCardNode,
  settleCard,
  transitionCardNode,
  updateCardNode,
} from './battleViews.js';
import {
  hideCardTooltip,
  showCardTooltip,
} from './battleCardTooltip.js';

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function handLayoutTuning(count) {
  if (count <= 1) {
    return { spreadFactor: 1, fanFactor: 0 };
  }
  if (count === 2) {
    return { spreadFactor: 0.78, fanFactor: 0.3 };
  }
  if (count === 3) {
    return { spreadFactor: 0.88, fanFactor: 0.55 };
  }
  if (count === 4) {
    return { spreadFactor: 0.94, fanFactor: 0.8 };
  }
  return { spreadFactor: 1, fanFactor: 1 };
}

export class BattleHandController {
  constructor(scene, options) {
    this.scene = scene;
    this.options = options;
    this.nodes = new Map();
    this.order = [];
  }

  getNode(instanceId) {
    return this.nodes.get(instanceId) ?? null;
  }

  getOrder() {
    return this.order;
  }

  getNodes() {
    return this.nodes;
  }

  detach(instanceId) {
    const node = this.nodes.get(instanceId) ?? null;
    if (!node) return null;
    this.nodes.delete(instanceId);
    this.order = this.order.filter((id) => id !== instanceId);
    return node;
  }

  remove(instanceId) {
    const node = this.detach(instanceId);
    if (node?.container?.active) {
      node.container.destroy();
    }
    return node ?? null;
  }

  sync(hand = [], { immediate = false } = {}) {
    const next = new Map(hand.map((card) => [card.instanceId, card]));
    const tooltip = this.scene.ui?.cardTooltip ?? null;

    if (tooltip?.cardInstanceId && !next.has(tooltip.cardInstanceId)) {
      hideCardTooltip(tooltip);
    }

    // 收集需要删除的节点（避免遍历中删除）
    const toRemove = [];
    for (const [instanceId, node] of this.nodes.entries()) {
      if (!next.has(instanceId) && !this.isTransientNode(node)) {
        toRemove.push(instanceId);
      }
    }
    toRemove.forEach((id) => this.remove(id));

    // 更新/创建节点
    hand.forEach((card) => {
      let node = this.nodes.get(card.instanceId);
      if (!node) {
        node = this.createNode(card);
        this.nodes.set(card.instanceId, node);
      } else {
        updateCardNode(node, card);
      }

      if (this.isTransientNode(node)) return;
      if (!this.isHandNode(node)) {
        node.uiState = CARD_STATES.idle;
      }
    });

    const prevOrder = this.order;
    this.order = hand.map((card) => card.instanceId);
    const layout = this.computeLayout(hand.length);
    const countChanged = prevOrder.length !== this.order.length;

    this.order.forEach((instanceId, index) => {
      const node = this.nodes.get(instanceId);
      if (!node) return;

      const slot = layout[index];
      const posChanged =
        countChanged ||
        node.baseX !== slot.x ||
        node.baseY !== slot.y ||
        node.baseRotation !== slot.rotation;

      node.baseX = slot.x;
      node.baseY = slot.y;
      node.baseRotation = slot.rotation;
      node.container.setDepth(110 + index);
      this.setNodeInteractive(node, true);

      if (this.options.getDraggedNode?.() === node) return;

      // 只有位置真正变化时才触发 settle 动画
      if (posChanged || node.uiState !== CARD_STATES.idle) {
        this.applyNodeState(node, { immediate });
      }
    });
  }

  createNode(card) {
    let node = null;
    node = createCardNode(this.scene, card, {
      x: this.scene.layout.hand.x,
      y: this.scene.layout.hand.y + 40,
      onPointerOver: () => {
        if (this.options.getMode?.() !== BATTLE_MODES.idle || this.options.getDraggedNode?.() === node) return;
        this.setNodeState(node, CARD_STATES.hover);
        showCardTooltip(this.scene.ui?.cardTooltip, node, node?.card ?? card);
      },
      onPointerOut: () => {
        if (this.options.getDraggedNode?.() === node) return;
        hideCardTooltip(this.scene.ui?.cardTooltip);
        this.returnNode(node);
      },
      onPointerDown: (pointer) => {
        this.options.onCardPointerDown?.(node, pointer);
      },
    });
    assignCardNodeDebugNames(node, `card.${card.instanceId}`);
    return node;
  }

  returnNode(node) {
    if (!node?.container?.active) return;
    if (!this.isHandNode(node)) return;
    hideCardTooltip(this.scene.ui?.cardTooltip);
    const nextState = this.options.getMode?.() === BATTLE_MODES.targeting
      && this.options.getTargetingCardId?.() === node.card?.instanceId
      ? CARD_STATES.targeting
      : CARD_STATES.idle;
    this.transitionNodeState(node, nextState);
    settleCard(this.scene, node, this.options.getMode?.() ?? BATTLE_MODES.idle);
  }

  setNodeState(node, state, { immediate = false } = {}) {
    if (!node?.container?.active) return;
    this.transitionNodeState(node, state);
    this.applyNodeState(node, { immediate });
  }

  applyNodeState(node, { immediate = false } = {}) {
    if (!node?.container?.active) return;
    if (node.uiState === CARD_STATES.drag || this.isTransientNode(node)) return;
    transitionCardNode(this.scene, node, cardPoseForState(node, node.uiState), {
      immediate,
      duration: immediate ? 0 : TIMING.settle,
      ease: isRaisedCardState(node.uiState) ? 'Quad.Out' : 'Cubic.Out',
    });
  }

  beginResolving(instanceId) {
    const node = this.getNode(instanceId);
    if (!node?.container?.active) return null;

    hideCardTooltip(this.scene.ui?.cardTooltip);
    this.order = this.order.filter((id) => id !== instanceId);
    this.transitionNodeState(node, CARD_STATES.resolving);
    return node;
  }

  beginZoneTransition(instanceId, zoneState) {
    const node = this.getNode(instanceId);
    if (!node?.container?.active) return null;

    hideCardTooltip(this.scene.ui?.cardTooltip);
    this.transitionNodeState(node, zoneState);
    return node;
  }

  clearTransientNodes() {
    for (const [instanceId, node] of this.nodes.entries()) {
      if (!this.isTransientNode(node)) continue;
      this.remove(instanceId);
    }
  }

  transitionNodeState(node, nextState) {
    if (!node?.container?.active || !nextState) return false;

    const prevState = node.uiState ?? CARD_STATES.idle;
    if (prevState !== nextState && !this.canTransition(prevState, nextState)) {
      return false;
    }

    node.uiState = nextState;
    this.applyStateMeta(node, nextState);
    return true;
  }

  canTransition(prevState, nextState) {
    return canTransitionCardState(prevState, nextState);
  }

  applyStateMeta(node, state) {
    const orderIndex = Math.max(0, this.order.indexOf(node.card?.instanceId));

    if (state === CARD_STATES.drag) {
      node.container.setDepth(220);
    } else if (isRaisedCardState(state)) {
      node.container.setDepth(180 + orderIndex);
    } else if (state === CARD_STATES.resolving) {
      node.container.setDepth(172);
    } else if (isZoneTransitionCardState(state)) {
      node.container.setDepth(176);
    } else {
      node.container.setDepth(110 + orderIndex);
    }

    this.setNodeInteractive(node, this.isHandNode(node));
  }

  isTransientNode(node) {
    return !!node && isTransientCardState(node.uiState);
  }

  isHandNode(node) {
    return !!node && isHandCardState(node.uiState);
  }

  setNodeInteractive(node, interactive) {
    if (!node?.container?.active) return;
    if (interactive) {
      node.container.setInteractive({ useHandCursor: true });
      return;
    }
    node.container.disableInteractive();
  }

  computeLayout(count) {
    if (count <= 0) return [];

    const hand = this.scene.layout.hand;
    const span = Math.max(0, hand.w - CARD_UI.hand.innerPadding * 2);
    const baseSpread = count === 1
      ? 0
      : Math.max(
        CARD_UI.hand.minSpacing,
        Math.min(CARD_UI.hand.maxSpacing, span / Math.max(1, count - 1)),
      );
    const { spreadFactor, fanFactor } = handLayoutTuning(count);
    const spread = baseSpread * spreadFactor;
    const mid = (count - 1) / 2;
    const baseY = hand.y + CARD_UI.hand.baseOffsetY;

    return Array.from({ length: count }, (_, index) => {
      const delta = index - mid;
      const normalized = mid === 0 ? 0 : delta / mid;
      return {
        x: hand.x + delta * spread,
        y: baseY + (
          Math.abs(normalized) * CARD_UI.hand.edgeLift
          + normalized ** 2 * CARD_UI.hand.arcLift
        ) * fanFactor,
        rotation: degToRad(normalized * CARD_UI.hand.maxAngle * fanFactor),
      };
    });
  }
}

