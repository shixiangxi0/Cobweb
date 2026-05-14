function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// `stageState` is temporary render runtime only.
// During clip playback we patch it step-by-step for visuals, then rebuild it
// from the final logic `viewState` once the queue drains.
// NOTE: shallow copy is sufficient because the render layer promises not to
// mutate nested objects in-place.
export function cloneBattleState(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice();
  return { ...value };
}

function getPatchedActor(stageState, actorId) {
  if (!actorId || !stageState) return null;
  if (actorId === 'player') return stageState.player;
  return stageState.enemies.find((enemy) => enemy.entityId === actorId) ?? null;
}

function patchStatusDelta(statuses, statusId, delta) {
  if (!statuses || !statusId || !delta) return;
  const current = statuses[statusId]?.stacks ?? 0;
  const next = current + delta;
  if (next <= 0) {
    delete statuses[statusId];
    return;
  }
  statuses[statusId] = { ...(statuses[statusId] ?? {}), stacks: next };
}

function lookupViewCard(viewState, instanceId, cardId = null) {
  const found = (viewState?.hand ?? []).find((card) => card.instanceId === instanceId);
  if (found) return found;
  return {
    instanceId,
    cardId: cardId ?? instanceId,
    display: { name: cardId ?? '牌', desc: '', type: 'skill' },
    cost: 0,
    targetType: 'none',
    exhaust: false,
  };
}

function sortPatchedHand(stageState, viewState) {
  const order = new Map((viewState?.hand ?? []).map((card, index) => [card.instanceId, index]));
  stageState.hand.sort((left, right) => {
    const a = order.get(left.instanceId) ?? 999;
    const b = order.get(right.instanceId) ?? 999;
    return a - b;
  });
}

function syncTurnStartPatch(stageState, viewState) {
  if (!viewState || !stageState) return;
  stageState.turn = viewState.turn;
  stageState.player.energy = viewState.player.energy;
  stageState.player.maxEnergy = viewState.player.maxEnergy;

  for (let i = 0; i < stageState.enemies.length; i++) {
    const enemy = stageState.enemies[i];
    const fresh = viewState.enemies.find((item) => item.entityId === enemy.entityId);
    if (fresh && fresh.intentDesc !== enemy.intentDesc) {
      stageState.enemies[i] = { ...enemy, intentDesc: fresh.intentDesc };
    }
  }
}

function adjustPileCount(stageState, zone, delta) {
  if (!stageState?.piles || !zone || !delta) return;
  if (zone === 'drawPile') {
    stageState.piles.draw = Math.max(0, (stageState.piles.draw ?? 0) + delta);
    return;
  }
  if (zone === 'discardPile') {
    stageState.piles.discard = Math.max(0, (stageState.piles.discard ?? 0) + delta);
    return;
  }
  if (zone === 'exhaustPile') {
    stageState.piles.exhaust = Math.max(0, (stageState.piles.exhaust ?? 0) + delta);
  }
}

export function applyBattleRenderPatch(stageState, step, viewState) {
  if (!stageState || !step) return stageState;

  switch (step.kind) {
    case 'play_card': {
      const instanceId = step.refs?.instanceId;
      stageState.hand = stageState.hand.filter((card) => card.instanceId !== instanceId);
      if (Number.isFinite(step.data?.cost) && step.data.cost > 0) {
        stageState.player.energy = Math.max(0, stageState.player.energy - step.data.cost);
      }
      break;
    }

    case 'attack':
    case 'damage': {
      const target = getPatchedActor(stageState, step.target);
      if (target) {
        const blocked = Math.max(0, step.data?.blocked ?? 0);
        const loss = Math.max(0, step.data?.actualLoss ?? step.data?.actualDamage ?? step.data?.amount ?? 0);
        target.block = Math.max(0, (target.block ?? 0) - blocked);
        target.hp = Math.max(0, (target.hp ?? 0) - loss);
      }
      if (step.data?.fatal && step.target !== 'player') {
        stageState.enemies = stageState.enemies.filter((enemy) => enemy.entityId !== step.target);
      }
      break;
    }

    case 'loss': {
      const target = getPatchedActor(stageState, step.target);
      if (target) {
        const loss = Math.max(0, step.data?.actualLoss ?? step.data?.amount ?? 0);
        target.hp = Math.max(0, (target.hp ?? 0) - loss);
      }
      if (step.data?.fatal && step.target !== 'player') {
        stageState.enemies = stageState.enemies.filter((enemy) => enemy.entityId !== step.target);
      }
      break;
    }

    case 'gain_block': {
      const target = getPatchedActor(stageState, step.target);
      if (target) target.block = Math.max(0, (target.block ?? 0) + (step.data?.amount ?? 0));
      break;
    }

    case 'heal': {
      const target = getPatchedActor(stageState, step.target);
      if (target) target.hp = clamp((target.hp ?? 0) + (step.data?.amount ?? 0), 0, target.maxHp ?? 999);
      break;
    }

    case 'apply_status':
      patchStatusDelta(getPatchedActor(stageState, step.target)?.statuses, step.refs?.statusId, step.data?.stacks ?? 0);
      break;

    case 'remove_status':
      patchStatusDelta(getPatchedActor(stageState, step.target)?.statuses, step.refs?.statusId, -(Math.abs(step.data?.stacks ?? 0) || 1));
      break;

    case 'card_moved': {
      const from = step.data?.from;
      const to = step.data?.to;
      const instanceId = step.refs?.instanceId;

      if (from === 'hand' && instanceId) {
        stageState.hand = stageState.hand.filter((card) => card.instanceId !== instanceId);
      }
      if (from && from !== 'hand') {
        adjustPileCount(stageState, from, -1);
      }

      if (to === 'hand') {
        const card = lookupViewCard(viewState, instanceId, step.refs?.cardId);
        if (!stageState.hand.some((item) => item.instanceId === card.instanceId)) {
          stageState.hand.push(card);
          sortPatchedHand(stageState, viewState);
        }
      } else if (to) {
        adjustPileCount(stageState, to, 1);
      }
      break;
    }

    case 'turn_start':
      if (step.actor === 'player') syncTurnStartPatch(stageState, viewState);
      break;

    case 'battle_end':
      stageState.over = true;
      stageState.victory = !!step.data?.victory;
      break;

    default:
      break;
  }

  return stageState;
}
