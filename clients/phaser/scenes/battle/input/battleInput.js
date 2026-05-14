import { CARD_STATES } from '../state/battleCardState.js';
import { BATTLE_MODES } from '../state/battleModeState.js';
import { CARD_UI, COLORS, LAYOUT, TIMING } from '../../../src/constants.js';
import { truncateText } from '../view/battleText.js';
import { hideCardTooltip } from '../view/battleCardTooltip.js';

export class BattleInputController {
  constructor(scene, options) {
    this.scene = scene;
    this.options = options;
    this.drag = null;
    this.targetingCardId = null;
  }

  bindGlobalInput() {
    this.scene.ui.bgHitArea.on('pointerdown', () => {
      if (this.options.getMode() === BATTLE_MODES.paused) return;
      if (this.drag) {
        this.cancelDrag();
        return;
      }
      if (this.options.getMode() === BATTLE_MODES.targeting) this.cancelTargeting();
    });

    this.scene.input.on('pointermove', (pointer) => {
      if (this.options.getMode() === BATTLE_MODES.paused) return;
      if (this.drag && this.drag.pointerId === pointer.id) {
        this.updateDrag(pointer);
      } else if (this.options.getMode() === BATTLE_MODES.targeting) {
        this.drawTargetLine(pointer.worldX, pointer.worldY);
      }
    });

    this.scene.input.on('pointerup', (pointer) => {
      if (this.options.getMode() === BATTLE_MODES.paused) return;
      if (this.drag && this.drag.pointerId === pointer.id) {
        this.finishDrag(pointer);
      }
    });
  }

  onCardPointerDown(node, pointer) {
    if (this.options.getMode() === BATTLE_MODES.paused) return;
    if (!this.options.isPlayable(node.card)) {
      this.options.showToast('气不足。', COLORS.textSoft);
      return;
    }

    hideCardTooltip(this.scene.ui?.cardTooltip);
    this.cancelTargeting();

    this.drag = {
      node,
      pointerId: pointer.id,
      startX: pointer.worldX,
      startY: pointer.worldY,
      moved: false,
      hoverEnemyId: null,
    };

    node.container.setDepth(220);
    this.options.setHandNodeState?.(node, CARD_STATES.drag, { immediate: true });
    this.updateDropZones();
  }

  activateCard(node) {
    if (this.options.getMode() === BATTLE_MODES.paused) return;
    if (!node?.card) return;
    if (!this.options.isPlayable(node.card)) return;

    if (node.card.targetType === 'enemy') {
      if ((this.options.getEnemyCount?.() ?? 0) === 0) {
        this.options.showToast('当前无可取之敌。', COLORS.textSoft);
        return;
      }
      this.startTargeting(node.card.instanceId);
      return;
    }

    this.options.attemptPlay(node.card.instanceId, null);
  }

  startTargeting(instanceId) {
    if (this.options.getMode() === BATTLE_MODES.paused) return;
    this.targetingCardId = instanceId;
    this.options.setMode(BATTLE_MODES.targeting);

    const card = this.options.getHandNode(instanceId)?.card;
    const label = truncateText(card?.display?.name ?? card?.cardId ?? '卡', 18);
    this.scene.ui.targetHint.setText(`为 ${label} 取一处落点`);
    this.scene.ui.targetHint.setVisible(true);

    const node = this.options.getHandNode(instanceId);
    if (node) {
      this.options.setHandNodeState?.(node, CARD_STATES.targeting);
      this.drawTargetLine(node.container.x, node.container.y - LAYOUT.cardSize.h / 2);
    }
  }

  cancelTargeting() {
    const node = this.targetingCardId ? this.options.getHandNode(this.targetingCardId) : null;
    this.targetingCardId = null;
    if (!this.drag) {
      this.clearTargetingVisuals();
    }
    if (node && !this.drag) {
      this.options.returnHandNode?.(node);
    }
    if (this.options.getMode() === BATTLE_MODES.targeting) this.options.setMode(BATTLE_MODES.idle);
  }

  updateDrag(pointer) {
    if (!this.drag) return;

    const { node } = this.drag;
    const dx = pointer.worldX - this.drag.startX;
    const dy = pointer.worldY - this.drag.startY;
    if (!this.drag.moved && Math.hypot(dx, dy) > 14) {
      this.drag.moved = true;
    }

    if (!this.drag.moved) return;

    node.container.setPosition(pointer.worldX, pointer.worldY - CARD_UI.drag.cursorOffsetY);
    node.container.setRotation(Math.max(-CARD_UI.drag.maxTilt, Math.min(CARD_UI.drag.maxTilt, dx / CARD_UI.drag.tiltFactor)));
    node.container.setScale(CARD_UI.drag.scale);

    if (node.card.targetType === 'enemy') {
      this.targetingCardId = node.card.instanceId;
      if (this.options.getMode() !== BATTLE_MODES.targeting) this.options.setMode(BATTLE_MODES.targeting);
      this.drag.hoverEnemyId = this.findEnemyUnderPointer(pointer);
      this.options.refreshEnemyHighlights();
      this.updateDropZones();

      if (this.drag.hoverEnemyId) {
        const anchor = this.options.resolveActorAnchor(this.drag.hoverEnemyId);
        this.drawTargetLine(anchor.x, anchor.y - 18);
        this.scene.ui.targetHint.setText(`落在 ${this.options.actorName(this.drag.hoverEnemyId)}`);
      } else {
        this.drawTargetLine(pointer.worldX, pointer.worldY);
        this.scene.ui.targetHint.setText('牵墨至敌身');
      }
      this.scene.ui.targetHint.setVisible(true);
      return;
    }

    this.scene.ui.targetLine.clear();
    this.scene.ui.targetHint.setText(pointer.worldY < this.scene.layout.releaseZoneY ? '松手成势' : '拖入局中');
    this.scene.ui.targetHint.setVisible(true);
    this.updateDropZones({ playActive: pointer.worldY < this.scene.layout.releaseZoneY, handActive: pointer.worldY >= this.scene.layout.releaseZoneY });
  }

  finishDrag(pointer) {
    if (!this.drag) return;

    const { node, moved } = this.drag;
    const enemyId = node.card?.targetType === 'enemy' ? this.findEnemyUnderPointer(pointer) : null;
    const canCast = pointer.worldY < this.scene.layout.releaseZoneY;
    this.drag = null;
    this.updateDropZones();

    if (!moved) {
      if (node.card?.targetType === 'enemy') {
        this.returnCard(node);
      } else {
        node.container.setDepth(110 + Math.max(0, this.options.getHandOrder().indexOf(node.card?.instanceId)));
      }
      this.activateCard(node);
      return;
    }

    if (node.card?.targetType === 'enemy') {
      if (enemyId) {
        this.options.attemptPlay(node.card.instanceId, enemyId);
        return;
      }
      this.options.showToast('请落在敌身。', COLORS.textSoft);
      this.cancelTargeting();
      this.returnCard(node);
      return;
    }

    if (canCast) {
      this.options.attemptPlay(node.card.instanceId, null);
      return;
    }

    this.options.showToast('请在局中松手。', COLORS.textSoft);
    this.returnCard(node);
    this.options.setMode(BATTLE_MODES.idle);
  }

  cancelDrag() {
    if (!this.drag) return;
    const { node } = this.drag;
    this.drag = null;
    this.updateDropZones();
    this.returnCard(node);
    this.cancelTargeting();
  }

  returnCard(node) {
    if (!node?.container?.active) return;
    node.container.setDepth(110 + Math.max(0, this.options.getHandOrder().indexOf(node.card?.instanceId)));
    this.options.returnHandNode?.(node);
  }

  drawTargetLine(toX, toY) {
    this.scene.ui.targetLine.clear();
    const instanceId = this.drag?.node?.card?.instanceId ?? this.targetingCardId;
    if (!instanceId) return;

    const node = this.options.getHandNode(instanceId) ?? this.drag?.node ?? null;
    if (!node) return;

    const fromX = node.container.x;
    const fromY = node.container.y - LAYOUT.cardSize.h / 2 + 10;
    const midX = (fromX + toX) / 2;
    const midY = Math.min(fromY, toY) - 34;

    this.scene.ui.targetLine.lineStyle(3, COLORS.targetLine, 0.95);
    this.scene.ui.targetLine.beginPath();
    this.scene.ui.targetLine.moveTo(fromX, fromY);
    this.scene.ui.targetLine.lineTo(midX, midY);
    this.scene.ui.targetLine.lineTo(toX, toY);
    this.scene.ui.targetLine.strokePath();
  }

  findEnemyUnderPointer(pointer) {
    for (const [enemyId, node] of this.options.getEnemyNodes()) {
      if (node.container.getBounds().contains(pointer.worldX, pointer.worldY)) {
        return enemyId;
      }
    }
    return null;
  }

  clearAfterAction({ skipReturnInstanceId = null } = {}) {
    hideCardTooltip(this.scene.ui?.cardTooltip);
    const node = this.targetingCardId && !this.drag
      ? this.options.getHandNode(this.targetingCardId)
      : null;
    this.targetingCardId = null;
    this.drag = null;
    this.updateDropZones();
    if (node && node.card?.instanceId !== skipReturnInstanceId) {
      this.options.returnHandNode?.(node);
    }
    this.clearTargetingVisuals();
  }

  cancelForPause() {
    hideCardTooltip(this.scene.ui?.cardTooltip);
    const mode = this.options.getMode();
    const dragNode = this.drag?.node ?? null;
    const targetingNode = !dragNode && this.targetingCardId
      ? this.options.getHandNode(this.targetingCardId)
      : null;

    this.drag = null;
    this.targetingCardId = null;
    this.updateDropZones();

    if (dragNode) {
      this.returnCard(dragNode);
    } else if (targetingNode) {
      this.options.returnHandNode?.(targetingNode);
    }

    if (mode === BATTLE_MODES.targeting) {
      this.options.setMode(BATTLE_MODES.idle);
    }

    this.clearTargetingVisuals();
  }

  clearTargetingVisuals() {
    this.scene.ui.targetHint.setVisible(false);
    this.scene.ui.targetLine.clear();
  }

  refreshLayout() {
    if (this.options.getMode() === BATTLE_MODES.paused) return;

    if (this.drag?.node) {
      if (this.drag.node.card?.targetType === 'enemy') {
        this.options.refreshEnemyHighlights();
        const anchor = this.drag.hoverEnemyId ? this.options.resolveActorAnchor(this.drag.hoverEnemyId) : null;
        if (anchor) {
          this.drawTargetLine(anchor.x, anchor.y - 18);
          this.scene.ui.targetHint.setText(`落在 ${this.options.actorName(this.drag.hoverEnemyId)}`);
          this.scene.ui.targetHint.setVisible(true);
        } else {
          this.scene.ui.targetLine.clear();
          this.scene.ui.targetHint.setVisible(false);
        }
        return;
      }

      const playActive = !!this.drag.moved && this.drag.node.container.y < this.scene.layout.releaseZoneY;
      this.scene.ui.targetHint.setText(playActive ? '松手成势' : '拖入局中');
      this.scene.ui.targetHint.setVisible(!!this.drag.moved);
      this.updateDropZones({
        playActive,
        handActive: !!this.drag.moved && !playActive,
      });
      return;
    }

    if (this.targetingCardId) {
      const node = this.options.getHandNode(this.targetingCardId);
      if (node?.container?.active) {
        const label = truncateText(node.card?.display?.name ?? node.card?.cardId ?? '卡', 18);
        this.scene.ui.targetHint.setText(`为 ${label} 取一处落点`);
        this.scene.ui.targetHint.setVisible(true);
        this.drawTargetLine(node.container.x, node.container.y - LAYOUT.cardSize.h / 2);
        this.options.refreshEnemyHighlights();
        return;
      }
    }

    this.clearTargetingVisuals();
  }

  updateDropZones({ playActive = false, handActive = false } = {}) {
    const playZone = this.scene.ui.playZone;
    const handZone = this.scene.ui.handZone;

    if (!playZone || !handZone) return;

    const showZones = !!this.drag && this.drag.moved && this.drag.node.card?.targetType !== 'enemy';
    playZone.container.setVisible(showZones);
    handZone.container.setVisible(showZones);

    if (!showZones) return;

    playZone.frame.setStrokeStyle(playActive ? 2 : 1, COLORS.targetGlow, playActive ? 0.58 : 0.12);
    playZone.fill.setAlpha(playActive ? 0.08 : 0.02);
    playZone.label.setColor(playActive ? COLORS.accentGold : COLORS.textDim);

    handZone.frame.setStrokeStyle(handActive ? 1.8 : 1, COLORS.frameSoft, handActive ? 0.34 : 0.1);
    handZone.fill.setAlpha(handActive ? 0.06 : 0.015);
    handZone.label.setColor(handActive ? COLORS.textSoft : COLORS.textDim);
  }
}

