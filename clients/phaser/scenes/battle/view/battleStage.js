import { BATTLE_MODES } from '../state/battleModeState.js';
import { ACTOR_MOTION_STATES } from '../state/battleActorState.js';
import { syncEnemyDragonBonesAvatar } from '../animation/battleDragonBones.js';
import { refreshEnemyTargetState } from '../state/battleUiState.js';
import {
  assignActorNodeDebugNames,
  beginActorNodeMotion,
  createActorNode,
  endActorNodeMotion,
  syncActorNodePosition,
  updateActorNode,
} from './battleViews.js';

export class BattleStageController {
  constructor(scene, options) {
    this.scene = scene;
    this.options = options;
    this.playerNode = null;
    this.enemyNodes = new Map();
  }

  createPlayerNode({ name = '' } = {}) {
    this.playerNode = createActorNode(this.scene, {
      isPlayer: true,
      x: this.scene.layout.playerAnchor.x,
      y: this.scene.layout.playerAnchor.y,
      name,
    });
    assignActorNodeDebugNames(this.playerNode, 'player');
    return this.playerNode;
  }

  sync(vs, statusDisplayMap) {
    if (!vs) return;
    this.syncPlayer(vs.player, statusDisplayMap);
    this.syncEnemies(vs.enemies ?? [], statusDisplayMap);
  }

  syncPlayer(player, statusDisplayMap) {
    if (!this.playerNode || !player) return;

    syncActorNodePosition(this.scene, this.playerNode, {
      x: this.scene.layout.playerAnchor.x,
      y: this.scene.layout.playerAnchor.y,
      immediate: true,
    });

    updateActorNode(this.scene, this.playerNode, {
      name: '',
      hp: player.hp,
      maxHp: player.maxHp,
      block: player.block,
      statuses: player.statuses,
      intent: null,
    }, statusDisplayMap);
  }

  syncEnemies(enemies, statusDisplayMap) {
    const nextIds = new Set(enemies.map((enemy) => enemy.entityId));
    for (const [enemyId, node] of this.enemyNodes.entries()) {
      if (!nextIds.has(enemyId)) {
        node.container.destroy();
        this.enemyNodes.delete(enemyId);
      }
    }

    const positions = this.computeEnemyPositions(enemies.length);
    enemies.forEach((enemy, index) => {
      const position = positions[index];
      let node = this.enemyNodes.get(enemy.entityId);
      if (!node) {
        node = this.createEnemyNode(enemy, position);
        this.enemyNodes.set(enemy.entityId, node);
      }

      syncActorNodePosition(this.scene, node, position);

      updateActorNode(this.scene, node, {
        name: enemy.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
        statuses: enemy.statuses,
        intent: enemy.intentDesc,
      }, statusDisplayMap);
      syncEnemyDragonBonesAvatar(this.scene, node, enemy);
    });
  }

  createEnemyNode(enemy, position) {
    const node = createActorNode(this.scene, {
      isPlayer: false,
      x: position.x,
      y: position.y,
      name: enemy.name,
      onPointerDown: () => {
        if (this.options.getMode?.() !== BATTLE_MODES.targeting) return;
        const targetingCardId = this.options.getTargetingCardId?.();
        if (!targetingCardId) return;
        this.options.onEnemySelected?.(enemy.entityId, targetingCardId);
      },
      onPointerOver: () => {
        node.hovered = true;
        this.refreshTargetHighlights();
      },
      onPointerOut: () => {
        node.hovered = false;
        this.refreshTargetHighlights();
      },
    });

    node.container.setData('entityId', enemy.entityId);
    assignActorNodeDebugNames(node, `enemy.${enemy.entityId}`);
    return node;
  }

  computeEnemyPositions(count) {
    if (count <= 0) return [];

    const area = this.scene.layout.enemyArea;
    const gap = count === 1 ? 0 : Math.min(260, area.w / Math.max(1.08, count - 0.04));
    const mid = (count - 1) / 2;

    return Array.from({ length: count }, (_, index) => {
      const delta = index - mid;
      return {
        x: area.cx + delta * gap,
        y: area.cy + Math.abs(delta) * 12,
      };
    });
  }

  refreshTargetHighlights() {
    refreshEnemyTargetState({
      scene: this.scene,
      enemyNodes: this.enemyNodes,
      mode: this.options.getMode?.() ?? BATTLE_MODES.loading,
      drag: this.options.getDrag?.() ?? null,
    });
  }

  beginMotion(actorId, motionState = ACTOR_MOTION_STATES.animating) {
    return beginActorNodeMotion(this.resolveNode(actorId), motionState);
  }

  endMotion(actorId, options = {}) {
    return endActorNodeMotion(this.scene, this.resolveNode(actorId), options);
  }

  getEnemyNodes() {
    return this.enemyNodes.entries();
  }

  getEnemyCount() {
    return this.enemyNodes.size;
  }

  resolveNode(actorId) {
    if (!actorId) return null;
    if (actorId === 'player') return this.playerNode;
    return this.enemyNodes.get(actorId) ?? null;
  }

  resolveAnchor(actorId) {
    const node = this.resolveNode(actorId);
    if (node) return { x: node.baseX, y: node.baseY };
    if (actorId === 'player') {
      return {
        x: this.scene.layout.playerAnchor.x,
        y: this.scene.layout.playerAnchor.y,
      };
    }
    return null;
  }

  actorName(actorId, stageState) {
    if (actorId === 'player') return '我方';
    return stageState?.enemies?.find((enemy) => enemy.entityId === actorId)?.name ?? actorId ?? 'Unit';
  }
}

