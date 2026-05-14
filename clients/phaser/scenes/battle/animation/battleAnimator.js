import {
  CARD_STATES,
  isTransientCardState,
} from '../state/battleCardState.js';
import { ACTOR_MOTION_STATES } from '../state/battleActorState.js';
import { getEnemySkinAnimations, playNodeAvatarAnimation, playNodeIdleAnimation } from './battleDragonBones.js';
import { CARD_UI, COLORS, TIMING } from '../../../src/constants.js';

const FLOAT_FONT = '"Arial Black", "Microsoft YaHei", sans-serif';
const FX = {
  charge: 90,
  trail: 140,
  impact: 180,
};

export class BattleAnimator {
  constructor(scene, options) {
    this.scene = scene;
    this.animQueue = options.animQueue;
    this.ui = options.ui;
    this.layout = options.layout;
    this.getHandNode = options.getHandNode;
    this.getHandNodes = options.getHandNodes;
    this.beginResolvingCard = options.beginResolvingCard;
    this.beginZoneTransition = options.beginZoneTransition;
    this.removeHandNode = options.removeHandNode;
    this.applyRenderPatch = options.applyRenderPatch;
    this.resolveActorNode = options.resolveActorNode;
    this.resolveActorAnchor = options.resolveActorAnchor;
    this.beginActorMotion = options.beginActorMotion;
    this.endActorMotion = options.endActorMotion;
    this.actorName = options.actorName;
    this.statusLabel = options.statusLabel;
    this.playFlowStep = options.playFlowStep;
    this.transientEffects = new Set();
  }

  async playClip(clip) {
    if (clip.kind === 'sequence') {
      await this.playSequenceClip(clip);
      return;
    }

    if (clip.kind === 'draw_batch') {
      await this.animateDrawBatch(clip.steps);
      return;
    }

    if (clip.kind === 'zone_batch') {
      await this.animateZoneBatch(clip.steps, clip.zoneKind);
      return;
    }

    const { step } = clip;
    switch (step.kind) {
      case 'battle_start':
        await this.animateBattleStart();
        break;
      case 'turn_start':
      case 'turn_end':
        await this.animateTurn(step);
        break;
      case 'enemy_action':
        await this.animateEnemyIntent(step);
        break;
      case 'play_card':
        await this.animatePlayCard(step);
        break;
      case 'attack':
        await this.animateAttack(step);
        break;
      case 'damage':
      case 'loss':
        await this.animateDirectImpact(step);
        break;
      case 'gain_block':
        await this.animateBlock(step);
        break;
      case 'heal':
        await this.animateHeal(step);
        break;
      case 'apply_status':
      case 'remove_status':
        await this.animateStatus(step);
        break;
      case 'battle_end':
        await this.animateBattleEnd(step);
        break;
      case 'card_moved':
        await this.animateCardMoved(step);
        break;
      default:
        if (this.playFlowStep) {
          const handled = await this.playFlowStep(step);
          if (handled) break;
        }
        await this.animQueue.wait(TIMING.pauseTiny);
        break;
    }
  }

  async playSequenceClip(clip) {
    const rootStep = clip.rootStep ?? null;
    if (!rootStep) return;
    let lastProcSource = null;

    if (rootStep.kind === 'play_card') {
      await this.animatePlayCard(rootStep);
      this.playSequenceLead(rootStep, { color: COLORS.accentGold, radius: 18, offsetY: -54 });
    } else if (rootStep.kind === 'enemy_action') {
      await this.animateEnemyIntent(rootStep);
      this.playSequenceLead(rootStep, { color: 0xc79a58, radius: 16, offsetY: -38, actor: rootStep.actor });
    } else {
      await this.playClip({ kind: 'single', step: rootStep });
    }

    if ((clip.clips?.length ?? 0) > 0) {
      await this.animQueue.wait(TIMING.pauseTiny);
    }

    for (const nestedClip of clip.clips ?? []) {
      const procSource = this.resolveClipProcSource(nestedClip);
      if (procSource && procSource !== lastProcSource) {
        await this.playProcSourceEffect(procSource);
        lastProcSource = procSource;
      }
      if (this.shouldPlayHandBatchPrelude(rootStep, nestedClip, procSource)) {
        await this.playHandBatchPrelude(procSource, nestedClip.steps ?? []);
      }
      await this.playClip(nestedClip);
    }
  }

  playSequenceLead(step, {
    color = COLORS.accentGold,
    radius = 18,
    offsetY = -42,
    actor = 'player',
  } = {}) {
    const anchorId = step.target ?? actor;
    const anchor = this.resolveActorAnchor(anchorId);
    if (!anchor) return;
    this.spawnImpactBurst(anchor.x, anchor.y + offsetY, {
      color,
      radius,
      alpha: 0.24,
    });
  }

  resolveClipProcSource(clip) {
    if (!clip) return null;
    if (clip.kind === 'single') return clip.step?.refs?.procSource ?? null;
    if (clip.kind === 'draw_batch' || clip.kind === 'zone_batch') {
      return clip.steps?.[0]?.refs?.procSource ?? null;
    }
    return null;
  }

  shouldPlayHandBatchPrelude(rootStep, clip, procSource) {
    return rootStep?.kind === 'play_card'
      && clip?.kind === 'zone_batch'
      && clip.zoneKind === 'discarded'
      && (clip.steps?.length ?? 0) > 1
      && !!procSource
      && procSource === rootStep?.refs?.instanceId;
  }

  async playHandBatchPrelude(procSource, steps = []) {
    const discardIds = steps
      .map((step) => step?.refs?.instanceId ?? null)
      .filter(Boolean);
    if (discardIds.length === 0) return false;

    const sourceNode = this.getHandNode(procSource) ?? null;
    const focusX = sourceNode?.container?.x ?? this.layout?.hand?.x ?? 0;
    const focusY = sourceNode?.container?.y ?? this.layout?.hand?.y ?? 0;
    const handNodes = discardIds
      .map((instanceId) => this.getHandNode(instanceId))
      .filter((node) => node?.container?.active);

    if (handNodes.length === 0 && !sourceNode?.container?.active) return false;

    this.spawnImpactBurst(focusX, focusY - 52, {
      color: COLORS.accentGold,
      radius: 18,
      alpha: 0.16,
    });

    if (sourceNode?.container?.active) {
      this.scene.tweens.killTweensOf(sourceNode.container);
      this.scene.tweens.killTweensOf(sourceNode.glow);
      this.scene.tweens.add({
        targets: sourceNode.container,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 90,
        ease: 'Quad.Out',
        yoyo: true,
      });
      if (sourceNode.glow) {
        this.scene.tweens.add({
          targets: sourceNode.glow,
          alpha: 0.22,
          duration: 90,
          ease: 'Quad.Out',
          yoyo: true,
        });
      }
    }

    handNodes.forEach((node, index) => {
      const offset = index - (handNodes.length - 1) / 2;
      const targetX = focusX + offset * 24;
      const targetY = focusY - 20 - Math.abs(offset) * 6;
      const targetRotation = offset * 0.05;

      this.scene.tweens.killTweensOf(node.container);
      this.scene.tweens.killTweensOf(node.glow);
      this.scene.tweens.killTweensOf(node.shadow);

      this.scene.tweens.add({
        targets: node.container,
        x: targetX,
        y: targetY,
        rotation: targetRotation,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 110,
        delay: index * 16,
        ease: 'Cubic.Out',
      });
      if (node.glow) {
        this.scene.tweens.add({
          targets: node.glow,
          alpha: 0.14,
          duration: 96,
          delay: index * 16,
          ease: 'Quad.Out',
          yoyo: true,
        });
      }
      if (node.shadow) {
        this.scene.tweens.add({
          targets: node.shadow,
          alpha: 0.18,
          duration: 96,
          delay: index * 16,
          ease: 'Quad.Out',
          yoyo: true,
        });
      }
    });

    await this.animQueue.wait(120 + handNodes.length * 16);
    return true;
  }

  async playProcSourceEffect(procSource) {
    if (!procSource) return false;

    if (procSource.includes(':')) {
      const splitIndex = procSource.indexOf(':');
      const actorId = procSource.slice(0, splitIndex);
      const statusId = procSource.slice(splitIndex + 1);
      const anchor = this.resolveActorAnchor(actorId);
      if (!anchor) return false;

      this.spawnImpactBurst(anchor.x, anchor.y - 46, {
        color: COLORS.accentGold,
        radius: 14,
        alpha: 0.2,
      });
      if (statusId) {
        this.spawnFloatingText(anchor.x, anchor.y - 118, this.statusLabel(statusId), COLORS.accentGold, 14);
      }
      await this.animQueue.wait(32);
      return true;
    }

    const cardNode = this.getHandNode(procSource);
    if (cardNode?.container?.active) {
      this.scene.tweens.killTweensOf(cardNode.container);
      this.scene.tweens.killTweensOf(cardNode.glow);
      this.scene.tweens.add({
        targets: cardNode.container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 80,
        ease: 'Quad.Out',
        yoyo: true,
      });
      if (cardNode.glow) {
        this.scene.tweens.add({
          targets: cardNode.glow,
          alpha: 0.24,
          duration: 80,
          ease: 'Quad.Out',
          yoyo: true,
        });
      }
      await this.animQueue.wait(28);
      return true;
    }

    const anchor = this.resolveActorAnchor(procSource);
    if (anchor) {
      this.spawnImpactBurst(anchor.x, anchor.y - 42, {
        color: COLORS.accentTeal,
        radius: 14,
        alpha: 0.2,
      });
      await this.animQueue.wait(28);
      return true;
    }

    return false;
  }

  async animateBattleStart() {
    await this.playBanner('开局', COLORS.textMain);
  }

  async animateTurn(step) {
    if (step.kind === 'turn_start' && step.actor === 'player') {
      this.applyRenderPatch(step);
      await this.playBanner('我方回合', COLORS.textMain);
      await this.animQueue.wait(TIMING.pauseSmall);
      return;
    }

    if (step.kind === 'turn_end') {
      await this.playBanner('敌方回合', COLORS.textSoft);
      return;
    }

    await this.playBanner(`${this.actorName(step.actor)} 起势`, COLORS.textMain);
  }

  async animateEnemyIntent(step) {
    const node = this.resolveActorNode(step.actor);
    if (node?.intentText?.active) {
      this.scene.tweens.add({
        targets: node.intentText,
        alpha: 0.36,
        duration: 120,
        yoyo: true,
      });
    }
    await this.animQueue.wait(TIMING.pauseSmall);
  }

  async animatePlayCard(step) {
    const instanceId = step.refs?.instanceId;
    const node = this.beginResolvingCard?.(instanceId) ?? this.getHandNode(instanceId);

    if (!node) {
      this.applyRenderPatch(step, { immediateHand: false });
      await this.animQueue.wait(TIMING.pauseTiny);
      return;
    }

    const playOrigin = {
      x: node.container.x,
      y: node.container.y,
      rotation: node.container.rotation,
    };

    if (node?.container?.active) {
      node.container.setAlpha(1);
      node.container.setScale(1, 1);
      node.container.setRotation(playOrigin.rotation ?? 0);
      node.container.setPosition(playOrigin.x, playOrigin.y);

      this.scene.tweens.killTweensOf(node.container);
      this.scene.tweens.killTweensOf(node.glow);
      this.scene.tweens.killTweensOf(node.shadow);

      this.scene.tweens.add({
        targets: node.glow,
        alpha: 0.18,
        duration: 90,
        ease: 'Quad.Out',
        yoyo: true,
      });
      if (node.shadow) {
        this.scene.tweens.add({
          targets: node.shadow,
          alpha: 0.16,
          duration: 90,
          ease: 'Quad.Out',
          yoyo: true,
        });
      }
    }

    this.applyRenderPatch(step, { immediateHand: false });
    await this.animQueue.wait(TIMING.pauseTiny);
  }

  async animateAttack(step) {
    const attacker = this.beginActorMotion?.(step.actor, ACTOR_MOTION_STATES.attack) ?? this.resolveActorNode(step.actor);
    const target = this.resolveActorAnchor(step.target);

    // play attacker's attack animation
    const attackerAnims = getEnemySkinAnimations(attacker);
    if (attackerAnims) {
      playNodeAvatarAnimation(attacker, attackerAnims.attack);
    }

    if (attacker?.container?.active && target) {
      const dx = target.x - attacker.baseX;
      const dy = target.y - attacker.baseY;
      const length = Math.max(1, Math.hypot(dx, dy));
      const backX = attacker.baseX - (dx / length) * 16;
      const backY = attacker.baseY - (dy / length) * 10;
      const rushX = attacker.baseX + (dx / length) * 26;
      const rushY = attacker.baseY + (dy / length) * 16;

      await this.animQueue.tween({
        targets: attacker.container,
        x: backX,
        y: backY,
        scaleX: 0.94,
        scaleY: 1.06,
        duration: FX.charge,
        ease: 'Quad.Out',
      });

      this.spawnAttackTrail(attacker.baseX, attacker.baseY - 12, target.x, target.y - 18);

      await this.animQueue.tween({
        targets: attacker.container,
        x: rushX,
        y: rushY,
        scaleX: 1.08,
        scaleY: 0.9,
        duration: TIMING.lunge,
        ease: 'Quad.Out',
      });

      await this.animateDirectImpact(step);

      await this.animQueue.tween({
        targets: attacker.container,
        x: attacker.baseX,
        y: attacker.baseY,
        scaleX: 1,
        scaleY: 1,
        duration: TIMING.recoil,
        ease: 'Quad.In',
      });

      // return to idle after attack
      this.endActorMotion?.(step.actor, { immediate: true });
      playNodeIdleAnimation(attacker);
      return;
    }

    this.endActorMotion?.(step.actor, { immediate: true });
    await this.animateDirectImpact(step);
  }

  async animateDirectImpact(step) {
    await this.animateHit(step.target, step.data?.actualLoss ?? step.data?.actualDamage ?? step.data?.amount ?? 0, {
      blocked: step.data?.blocked ?? 0,
      renderPatch: step,
    });
  }

  async animateHit(targetId, amount, { blocked = 0, renderPatch = null } = {}) {
    const targetNode = this.resolveActorNode(targetId);
    const anchor = this.resolveActorAnchor(targetId);

    // play target's damage animation
    const targetAnims = getEnemySkinAnimations(targetNode);
    if (targetAnims) {
      playNodeAvatarAnimation(targetNode, targetAnims.damage);
      // return to idle after damage anim (~500ms at 30fps for 'Damage' which is 30 frames)
      this.animQueue.delayCall(520, () => playNodeIdleAnimation(targetNode));
    }

    if (targetNode?.container?.active) {
      this.scene.tweens.add({
        targets: targetNode.container,
        alpha: 0.72,
        duration: 70,
        yoyo: true,
      });
    }

    if (renderPatch) {
      this.applyRenderPatch(renderPatch);
    }

    if (anchor) {
      const loss = Math.max(0, Number.isFinite(amount) ? amount : 0);
      if (loss > 0) {
        this.spawnImpactBurst(anchor.x, anchor.y - 24, { color: 0x8b0000, radius: 34 });
        this.shakeCamera(loss);
        this.spawnFloatingText(anchor.x, anchor.y - 104, `-${loss}`, '#ff3333', 26, {
          stroke: '#000000',
          shadow: '#000000',
        });
      }
      if (blocked > 0) {
        this.spawnFloatingText(anchor.x + 42, anchor.y - 82, `守 ${blocked}`, '#3b5566', 18, {
          stroke: '#ffffff',
          shadow: '#000000',
        });
      }
    }

    await this.animQueue.wait(TIMING.pauseSmall);
  }

  async animateBlock(step) {
    const anchor = this.resolveActorAnchor(step.target);
    this.applyRenderPatch(step);

    if (anchor) {
      this.spawnImpactBurst(anchor.x, anchor.y - 18, { color: 0x2f4f6a, radius: 28, alpha: 0.42 });
      this.spawnFloatingText(anchor.x, anchor.y - 90, `+${step.data?.amount ?? 0} 守`, '#2f4f6a', 20, {
        stroke: '#ffffff',
        shadow: '#000000',
      });
    }
    await this.animQueue.wait(TIMING.pauseSmall);
  }

  async animateHeal(step) {
    const anchor = this.resolveActorAnchor(step.target);
    this.applyRenderPatch(step);

    if (anchor) {
      this.spawnImpactBurst(anchor.x, anchor.y - 18, { color: 0x2f6b4e, radius: 24, alpha: 0.32 });
      this.spawnFloatingText(anchor.x, anchor.y - 92, `+${step.data?.amount ?? 0}`, '#2f6b4e', 22, {
        stroke: '#ffffff',
        shadow: '#000000',
      });
    }
    await this.animQueue.wait(TIMING.pauseSmall);
  }

  async animateStatus(step) {
    const anchor = this.resolveActorAnchor(step.target);
    this.applyRenderPatch(step);

    if (anchor) {
      const positive = step.kind === 'apply_status';
      const statusName = this.statusLabel(step.refs?.statusId);
      const stacks = Math.abs(step.data?.stacks ?? 0);
      const text = `${positive ? '+' : '-'} ${statusName}${stacks ? ` ${stacks}` : ''}`;
      this.spawnFloatingText(anchor.x, anchor.y - 116, text, positive ? COLORS.accentGold : COLORS.accentRose, 18);
    }
    await this.animQueue.wait(TIMING.pauseSmall);
  }

  async animateDrawBatch(steps) {
    const drawPile = this.resolvePileWidget('draw');

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const instanceId = step.refs?.instanceId;
      this.applyRenderPatch(step, { immediateHand: false });
      const node = this.getHandNode(instanceId);
      if (node?.container?.active) {
        const batchOffset = index - (steps.length - 1) / 2;
        const jitterX = batchOffset * 10 + (Math.random() - 0.5) * 8;
        const launchX = this.layout.piles.draw.x + jitterX;
        const launchY = this.layout.piles.draw.y - 8;

        this.pulsePile(drawPile, { glowAlpha: 0.24, scale: 1.04 });
        this.emphasizeHandReflow({ excludeInstanceId: instanceId });

        this.scene.tweens.killTweensOf(node.container);
        this.scene.tweens.killTweensOf(node.glow);

        node.container.setPosition(launchX, launchY);
        node.container.setRotation(CARD_UI.draw.startRotation + jitterX * 0.004);
        node.container.setScale(CARD_UI.draw.startScale);
        node.container.setAlpha(CARD_UI.draw.startAlpha);
        node.glow?.setAlpha(0.16);

        await this.animQueue.tween({
          targets: node.container,
          x: launchX + 28,
          y: launchY - 24,
          rotation: -0.06,
          scaleX: 0.9,
          scaleY: 0.9,
          alpha: 1,
          duration: 90,
          ease: 'Quad.Out',
        });

        await this.animQueue.tween({
          targets: node.container,
          x: node.baseX,
          y: node.baseY,
          rotation: node.baseRotation,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: TIMING.draw,
          ease: 'Cubic.Out',
        });
        this.scene.tweens.add({
          targets: node.glow,
          alpha: 0,
          duration: 120,
          ease: 'Quad.Out',
        });
      }
      await this.animQueue.wait(40);
    }
  }

  async animateZoneBatch(steps, zoneKind) {
    const pile = zoneKind === 'discarded' ? this.layout.piles.discard : this.layout.piles.exhaust;
    const pileWidget = this.resolvePileWidget(zoneKind === 'discarded' ? 'discard' : 'exhaust');

    for (const step of steps) {
      const instanceId = step.refs?.instanceId;
      const node = this.getHandNode(instanceId) ?? null;

      if (node?.container?.active) {
        this.beginZoneTransition?.(
          instanceId,
          zoneKind === 'discarded' ? CARD_STATES.discarding : CARD_STATES.exhausting,
        );
        const direction = pile.x >= node.container.x ? 1 : -1;
        const textureKey = node.body?.texture?.key ?? null;
        if (zoneKind === 'discarded') {
          await this.animateDiscardNode(node, pile, direction);
        } else {
          await this.animateExhaustNode(node, pile, direction);
        }

        this.removeHandNode(instanceId);

        if (textureKey) {
          if (zoneKind === 'discarded') {
            this.spawnPileGhost(textureKey, pile.x, pile.y, direction * 0.12);
          } else {
            this.spawnExhaustGhost(textureKey, pile.x, pile.y);
          }
        }
      }

      this.applyRenderPatch(step, { immediateHand: false });
      this.pulsePile(pileWidget, {
        glowAlpha: zoneKind === 'discarded' ? 0.3 : 0.28,
        scale: zoneKind === 'discarded' ? 1.05 : 1.06,
      });
      if (zoneKind === 'exhausted') {
        this.spawnFloatingText(pile.x, pile.y - 76, '焚', COLORS.accentRose, 20);
      }
      this.emphasizeHandReflow();
      await this.animQueue.wait(40);
    }
  }

  async animateCardMoved(step) {
    const instanceId = step.refs?.instanceId;
    const node = this.getHandNode(instanceId) ?? null;
    const to = step.data?.to;

    if (!node?.container?.active) {
      this.applyRenderPatch(step, { immediateHand: false });
      await this.animQueue.wait(TIMING.pauseTiny);
      return;
    }

    const isExhaust = to === 'exhaustPile';
    const pile = isExhaust ? this.layout.piles.exhaust : this.layout.piles.discard;
    const pileWidget = this.resolvePileWidget(isExhaust ? 'exhaust' : 'discard');

    this.beginZoneTransition?.(
      instanceId,
      isExhaust ? CARD_STATES.exhausting : CARD_STATES.discarding,
    );

    const direction = pile.x >= node.container.x ? 1 : -1;
    const textureKey = node.body?.texture?.key ?? null;

    if (isExhaust) {
      await this.animateExhaustNode(node, pile, direction);
    } else {
      await this.animateDiscardNode(node, pile, direction);
    }

    this.removeHandNode(instanceId);

    if (textureKey) {
      if (isExhaust) {
        this.spawnExhaustGhost(textureKey, pile.x, pile.y);
      } else {
        this.spawnPileGhost(textureKey, pile.x, pile.y, direction * 0.12);
      }
    }

    this.applyRenderPatch(step, { immediateHand: false });
    this.pulsePile(pileWidget, {
      glowAlpha: isExhaust ? 0.28 : 0.3,
      scale: isExhaust ? 1.06 : 1.05,
    });
    if (isExhaust) {
      this.spawnFloatingText(pile.x, pile.y - 76, '焚', COLORS.accentRose, 20);
    }
    this.emphasizeHandReflow();
  }

  async animateBattleEnd(step) {
    this.applyRenderPatch(step);
    const text = step.data?.victory ? '胜' : '败';
    await this.playBanner(text, COLORS.textMain);

    if (!this.ui.overlayText?.active || !this.ui.overlayBg?.active) {
      await this.animQueue.wait(TIMING.pauseSmall);
      return;
    }

    this.ui.overlayBg.setAlpha(0.62);
    this.ui.overlayText.setText(text).setColor(COLORS.textMain).setAlpha(0).setY(this.scene.H / 2);
    await this.animQueue.tween({
      targets: this.ui.overlayText,
      alpha: 1,
      y: this.scene.H / 2 - 18,
      duration: 420,
      ease: 'Cubic.Out',
    });
  }

  async playBanner(text, color) {
    if (!this.ui.banner?.active) {
      await this.animQueue.wait(TIMING.pauseTiny);
      return;
    }

    this.ui.banner.setText(text).setColor(color).setAlpha(0).setScale(0.92);
    this.ui.banner.setY(this.layout.stage.y - this.layout.stage.h / 2 + 58);

    await this.animQueue.tween({
      targets: this.ui.banner,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: TIMING.banner,
      ease: 'Cubic.Out',
    });
    await this.animQueue.wait(TIMING.pauseTiny);
    await this.animQueue.tween({
      targets: this.ui.banner,
      alpha: 0,
      y: this.ui.banner.y - 14,
      duration: 160,
      ease: 'Quad.In',
    });
  }

  spawnFloatingText(x, y, text, color, size = 20, {
    stroke = '#000000',
    shadow = '#000000',
  } = {}) {
    const root = this.scene.add.container(x, y).setDepth(205);
    const shade = this.scene.add.text(2, 2, text, {
      fontFamily: FLOAT_FONT,
      fontSize: `${size}px`,
      color: shadow,
      fontStyle: 'bold',
      stroke: shadow,
      strokeThickness: Math.max(2, Math.round(size * 0.12)),
    }).setOrigin(0.5);
    const label = this.scene.add.text(0, 0, text, {
      fontFamily: FLOAT_FONT,
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: Math.max(2, Math.round(size * 0.15)),
    }).setOrigin(0.5);

    root.add([shade, label]);
    this._trackTransientEffect(root);

    this.scene.tweens.add({
      targets: root,
      y: y - 42,
      alpha: 0,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: TIMING.float,
      ease: 'Cubic.Out',
      onComplete: () => root.destroy(),
    });
  }

  spawnAttackTrail(fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const length = Math.max(18, Math.hypot(toX - fromX, toY - fromY) * 0.58);
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const trail = this.scene.add.rectangle(midX, midY, length, 6, 0x111111, 0.16)
      .setRotation(angle)
      .setDepth(202);
    const core = this.scene.add.rectangle(midX, midY, length * 0.76, 2, 0xf8f4eb, 0.48)
      .setRotation(angle)
      .setDepth(203);
    this._trackTransientEffect(trail);
    this._trackTransientEffect(core);

    this.scene.tweens.add({
      targets: [trail, core],
      alpha: 0,
      scaleX: 1.08,
      duration: FX.trail,
      ease: 'Quad.Out',
      onComplete: () => {
        trail.destroy();
        core.destroy();
      },
    });
  }

  spawnImpactBurst(x, y, {
    color = 0x8b0000,
    radius = 28,
    alpha = 0.56,
  } = {}) {
    const graphics = this.scene.add.graphics().setPosition(x, y).setDepth(204);
    graphics.lineStyle(2.5, color, alpha);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      graphics.lineBetween(
        Math.cos(angle) * 6,
        Math.sin(angle) * 6,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    }
    graphics.lineStyle(2, color, alpha * 0.82);
    graphics.strokeCircle(0, 0, Math.max(6, radius * 0.26));
    this._trackTransientEffect(graphics);

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: FX.impact,
      ease: 'Cubic.Out',
      onComplete: () => graphics.destroy(),
    });
  }

  shakeCamera(amount = 0) {
    const camera = this.scene.cameras?.main ?? null;
    if (!camera) return;
    const intensity = Math.min(0.008, 0.0015 + Math.max(0, amount) * 0.00018);
    camera.shake(90, intensity, true);
  }

  resolvePileWidget(kind) {
    if (kind === 'draw') return this.ui.drawPile ?? null;
    if (kind === 'discard') return this.ui.discardPile ?? null;
    if (kind === 'exhaust') return this.ui.exhaustPile ?? null;
    return null;
  }

  pulsePile(pileNode, { glowAlpha = 0.24, scale = 1.05 } = {}) {
    if (!pileNode?.container?.active) return;

    this.scene.tweens.killTweensOf(pileNode.container);
    this.scene.tweens.killTweensOf(pileNode.glow);
    this.scene.tweens.killTweensOf(pileNode.accent);

    this.scene.tweens.add({
      targets: pileNode.container,
      scaleX: scale,
      scaleY: scale,
      duration: 110,
      ease: 'Quad.Out',
      yoyo: true,
    });
    this.scene.tweens.add({
      targets: pileNode.glow,
      alpha: glowAlpha,
      duration: 110,
      ease: 'Quad.Out',
      yoyo: true,
    });
    if (pileNode.accent) {
      this.scene.tweens.add({
        targets: pileNode.accent,
        alpha: 0.5,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 110,
        ease: 'Quad.Out',
        yoyo: true,
      });
    }
  }

  emphasizeHandReflow({ excludeInstanceId = null } = {}) {
    const handNodes = this.getHandNodes?.();
    if (!handNodes?.values) return;

    let index = 0;
    for (const node of handNodes.values()) {
      if (!node?.container?.active) continue;
      if (isTransientCardState(node.uiState)) continue;
      if (node.card?.instanceId === excludeInstanceId) continue;

      if (!node.shadow) continue;
      this.scene.tweens.killTweensOf(node.shadow);
      this.scene.tweens.add({
        targets: node.shadow,
        alpha: 0.15,
        duration: 70,
        delay: index * 12,
        ease: 'Quad.Out',
        yoyo: true,
      });
      index += 1;
    }
  }

  spawnPileGhost(textureKey, x, y, rotation = 0) {
    const ghost = this.scene.add.image(x, y, textureKey)
      .setScale(CARD_UI.discard.endScale * 0.96)
      .setRotation(rotation)
      .setAlpha(0.34)
      .setDepth(84);
    this._trackTransientEffect(ghost);

    this.scene.tweens.add({
      targets: ghost,
      y: y - 10,
      alpha: 0,
      scaleX: CARD_UI.discard.endScale * 1.04,
      scaleY: CARD_UI.discard.endScale * 1.04,
      duration: 180,
      ease: 'Quad.Out',
      onComplete: () => ghost.destroy(),
    });
  }

  async animateDiscardNode(node, pile, direction) {
    const target = this.resolveCardMotionTarget(node);
    if (!target) return;
    node.glow?.setAlpha(0.12);

    const startX = target.x;
    const startY = target.y;
    const distanceX = Math.abs(pile.x - startX);
    const peelX = startX + direction * Math.max(26, Math.min(52, distanceX * 0.18));
    const peelY = startY - 26;
    const sweepX = pile.x - direction * 22;
    const sweepY = pile.y - 16;

    await this.animQueue.tween({
      targets: target,
      x: peelX,
      y: peelY,
      rotation: direction * 0.1,
      scaleX: 0.94,
      scaleY: 0.94,
      duration: 85,
      ease: 'Quad.Out',
    });

    await this.animQueue.tween({
      targets: target,
      x: sweepX,
      y: sweepY,
      rotation: direction * 0.18,
      scaleX: 0.74,
      scaleY: 0.74,
      alpha: 0.9,
      duration: 110,
      ease: 'Sine.InOut',
    });

    await this.animQueue.tween({
      targets: target,
      x: pile.x,
      y: pile.y,
      rotation: direction * 0.24,
      scaleX: CARD_UI.discard.endScale,
      scaleY: CARD_UI.discard.endScale,
      alpha: 0,
      duration: 130,
      ease: 'Cubic.In',
    });
  }

  async animateExhaustNode(node, pile, direction) {
    const target = this.resolveCardMotionTarget(node);
    if (!target) return;
    node.glow?.setAlpha(0.2);

    await this.animQueue.tween({
      targets: target,
      x: target.x + direction * 10,
      y: target.y - 34,
      rotation: direction * 0.08,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 80,
      ease: 'Quad.Out',
    });

    this.scene.tweens.add({
      targets: node.glow,
      alpha: 0.24,
      duration: 80,
      ease: 'Quad.Out',
      yoyo: true,
    });

    await this.animQueue.tween({
      targets: target,
      x: (target.x + pile.x) / 2 + direction * 8,
      y: Math.min(target.y, pile.y) - 40,
      rotation: direction * 0.24,
      scaleX: 0.74,
      scaleY: 0.74,
      alpha: 0.8,
      duration: 110,
      ease: 'Sine.Out',
    });

    await this.animQueue.tween({
      targets: target,
      x: pile.x,
      y: pile.y - 10,
      rotation: direction * 0.36,
      scaleX: CARD_UI.discard.endScale * 0.78,
      scaleY: CARD_UI.discard.endScale * 0.78,
      alpha: 0,
      duration: TIMING.play,
      ease: 'Cubic.In',
    });
  }

  spawnExhaustGhost(textureKey, x, y) {
    const ghost = this.scene.add.image(x, y - 8, textureKey)
      .setScale(CARD_UI.discard.endScale * 0.72)
      .setAlpha(0.26)
      .setTint(0xa78978)
      .setDepth(84);
    this._trackTransientEffect(ghost);

    this.scene.tweens.add({
      targets: ghost,
      y: y - 28,
      alpha: 0,
      angle: 8,
      scaleX: CARD_UI.discard.endScale * 0.9,
      scaleY: CARD_UI.discard.endScale * 0.9,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => ghost.destroy(),
    });
  }

  resolveCardMotionTarget(node) {
    if (!node) return null;
    return node.container ?? node;
  }

  _trackTransientEffect(node) {
    if (!node) return node;
    this.transientEffects.add(node);
    node.once?.('destroy', () => {
      this.transientEffects.delete(node);
    });
    return node;
  }

  clearTransientEffects() {
    for (const node of this.transientEffects) {
      node?.destroy?.();
    }
    this.transientEffects.clear();
  }

  clearActiveCards() {}
}

