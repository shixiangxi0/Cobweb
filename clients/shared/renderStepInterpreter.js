import { buildTimelineGraph } from '../../games/sts/src/shared/timeline.js';
import {
  getPayload,
  sameImpactRef,
  findBridgeChild,
  resolveDamageChain,
  resolveAttackChain,
} from './timelineChains.js';

function shallowClone(value) {
  if (Array.isArray(value)) return value.slice();
  if (!value || typeof value !== 'object') return value;
  return { ...value };
}

function cloneTimeline(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    payload: (row?.payload && typeof row.payload === 'object') ? shallowClone(row.payload) : row?.payload,
  }));
}

const SEQUENCE_ROOT_EVENT_TO_KIND = Object.freeze({
  'card:play': 'play_card',
  'enemy:action': 'enemy_action',
});

function isRenderableProcSource(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('core:');
}

function toSource(node) {
  if (!node) return null;
  return {
    bundleIndex: node.bundleIndex,
    seq: node.seq,
    event: node.entry?.event ?? null,
  };
}

function collectSources(...nodes) {
  return nodes.map(toSource).filter(Boolean);
}

function resolveSequenceRoot(node) {
  let current = node ?? null;
  while (current) {
    const kind = SEQUENCE_ROOT_EVENT_TO_KIND[current.entry?.event] ?? null;
    if (kind) {
      return {
        id: current.key,
        kind,
      };
    }
    current = current.parent ?? null;
  }
  return null;
}

function withSequenceRefs(node, refs = {}) {
  const sequence = resolveSequenceRoot(node);
  if (!sequence) return refs;
  return {
    ...refs,
    sequenceId: sequence.id,
    sequenceKind: sequence.kind,
  };
}

function resolveProcSource(node) {
  let current = node ?? null;
  while (current) {
    const source = current.entry?.causeBy ?? null;
    if (isRenderableProcSource(source)) return source;
    current = current.parent ?? null;
  }
  return null;
}

function withProcSource(node, refs = {}) {
  const procSource = resolveProcSource(node);
  if (!procSource) return refs;
  return {
    ...refs,
    procSource,
  };
}

function withRenderRefs(node, refs = {}) {
  return withProcSource(node, withSequenceRefs(node, refs));
}

function buildImpactRefs(payload = {}) {
  return {
    actionId: payload.action ?? null,
    cardId: payload.cardId ?? null,
    instanceId: payload.instanceId ?? null,
  };
}

function buildAttackStep(chain) {
  const attackPayload = getPayload(chain.attackNode);
  const damagePayload = getPayload(chain.damageNode);
  const lossPayload = getPayload(chain.lossNode);
  return {
    kind: 'attack',
    seq: chain.attackNode?.seq ?? null,
    actor: attackPayload.source ?? null,
    target: attackPayload.target ?? null,
    refs: withRenderRefs(chain.attackNode, buildImpactRefs(attackPayload)),
    data: {
      amount: attackPayload.amount ?? 0,
      blocked: damagePayload.blocked ?? 0,
      actualDamage: damagePayload.actualDamage ?? null,
      actualLoss: lossPayload.actualLoss ?? lossPayload.amount ?? null,
      fatal: !!lossPayload.isFatal || !!chain.dieNode,
    },
    sources: collectSources(chain.attackNode, chain.damageNode, chain.lossNode, chain.dieNode),
  };
}

function buildDamageStep(chain) {
  const damagePayload = getPayload(chain.damageNode);
  const lossPayload = getPayload(chain.lossNode);
  return {
    kind: 'damage',
    seq: chain.damageNode?.seq ?? null,
    actor: damagePayload.source ?? null,
    target: damagePayload.target ?? null,
    refs: withRenderRefs(chain.damageNode, buildImpactRefs(damagePayload)),
    data: {
      amount: damagePayload.amount ?? 0,
      blocked: damagePayload.blocked ?? 0,
      actualDamage: damagePayload.actualDamage ?? null,
      actualLoss: lossPayload.actualLoss ?? lossPayload.amount ?? null,
      fatal: !!lossPayload.isFatal || !!chain.dieNode,
    },
    sources: collectSources(chain.damageNode, chain.lossNode, chain.dieNode),
  };
}

function buildLossStep(lossNode, dieNode) {
  const payload = getPayload(lossNode);
  return {
    kind: 'loss',
    seq: lossNode?.seq ?? null,
    actor: payload.source ?? null,
    target: payload.target ?? null,
    refs: withRenderRefs(lossNode, buildImpactRefs(payload)),
    data: {
      amount: payload.amount ?? 0,
      actualLoss: payload.actualLoss ?? payload.amount ?? 0,
      direct: !!payload.direct,
      fatal: !!payload.isFatal || !!dieNode,
    },
    sources: collectSources(lossNode, dieNode),
  };
}

function buildCardPlayStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'play_card',
    seq: node.seq,
    actor: 'player',
    target: payload.target ?? null,
    refs: withRenderRefs(node, {
      cardId: payload.cardId ?? null,
      instanceId: payload.instanceId ?? null,
    }),
    data: {
      cost: payload.cost ?? null,
    },
    sources: collectSources(node),
  };
}

function buildBattleStartStep(node) {
  return {
    kind: 'battle_start',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {},
    sources: collectSources(node),
  };
}

function buildTurnBoundaryStep(node) {
  const payload = getPayload(node);
  const isPlayerTurn = node.entry?.event?.startsWith('player:');
  const actor = isPlayerTurn ? 'player' : payload.target ?? null;
  if (!actor) return null;
  if (node.entry?.event === 'actor:turn:start' && payload.target === 'player') return null;
  return {
    kind: node.entry?.event?.endsWith(':start') ? 'turn_start' : 'turn_end',
    seq: node.seq,
    actor,
    target: null,
    refs: {},
    data: {},
    sources: collectSources(node),
  };
}

function buildEnemyActionStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'enemy_action',
    seq: node.seq,
    actor: payload.target ?? null,
    target: null,
    refs: withRenderRefs(node, {
      actionId: payload.action ?? null,
    }),
    data: {},
    sources: collectSources(node),
  };
}

function buildStatusStep(node) {
  const payload = getPayload(node);
  if (payload.typeId === 'block') return null;
  return {
    kind: node.entry?.event === 'status:apply' ? 'apply_status' : 'remove_status',
    seq: node.seq,
    actor: null,
    target: payload.target ?? null,
    refs: withRenderRefs(node, {
      statusId: payload.typeId ?? null,
    }),
    data: {
      stacks: payload.stacks ?? null,
    },
    sources: collectSources(node),
  };
}

function buildCardMoveStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'card_moved',
    seq: node.seq,
    actor: 'player',
    target: null,
    refs: withRenderRefs(node, {
      cardId: payload.cardId ?? null,
      instanceId: payload.instanceId ?? null,
    }),
    data: {
      from: payload.from ?? null,
      to: payload.to ?? null,
    },
    sources: collectSources(node),
  };
}

function buildHealStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'heal',
    seq: node.seq,
    actor: payload.source ?? null,
    target: payload.target ?? null,
    refs: withRenderRefs(node, {}),
    data: shallowClone(payload),
    sources: collectSources(node),
  };
}

function buildBlockStep(node) {
  const payload = getPayload(node);
  if ((payload.amount ?? 0) <= 0) return null;
  return {
    kind: 'gain_block',
    seq: node.seq,
    actor: payload.source ?? null,
    target: payload.target ?? null,
    refs: withRenderRefs(node, {}),
    data: shallowClone(payload),
    sources: collectSources(node),
  };
}

function buildBattleEndStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'battle_end',
    seq: node.seq,
    actor: null,
    target: null,
    refs: withRenderRefs(node, {}),
    data: shallowClone(payload),
    sources: collectSources(node),
  };
}

function buildRewardOpenStep(node) {
  const payload = getPayload(node);
  const entries = Array.isArray(payload.reward?.entries) ? payload.reward.entries : [];
  return {
    kind: 'reward_open',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {
      entryKeys: entries.map((entry) => entry?.key ?? null).filter(Boolean),
      entryCount: entries.length,
    },
    sources: collectSources(node),
  };
}

function inferRewardEntryKind(payload = {}) {
  if (payload.entryKind) return payload.entryKind;
  if (typeof payload.key !== 'string') return null;
  if (payload.key.startsWith('gold')) return 'gold';
  if (payload.key.startsWith('card:')) return 'card';
  if (payload.key.startsWith('relic:')) return 'relic';
  return null;
}

function buildRewardClaimStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'reward_claim',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {
      key: payload.key ?? null,
      entryKind: inferRewardEntryKind(payload),
      cardId: payload.cardId ?? null,
      relicId: payload.relicId ?? null,
      amount: payload.amount ?? null,
    },
    sources: collectSources(node),
  };
}

function buildRewardSkipStep(node) {
  return {
    kind: 'reward_skip',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {},
    sources: collectSources(node),
  };
}

function buildShopEnterStep(node) {
  const payload = getPayload(node);
  const stock = Array.isArray(payload.stock) ? payload.stock : [];
  return {
    kind: 'shop_enter',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {
      cardCount: stock.filter((item) => item?.type === 'card').length,
      relicCount: stock.filter((item) => item?.type === 'relic').length,
    },
    sources: collectSources(node),
  };
}

function buildShopBuyStep(node) {
  const payload = getPayload(node);
  return {
    kind: 'shop_buy',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {
      index: Number.isFinite(payload.index) ? payload.index - 1 : null,
      itemKind: payload.itemKind ?? null,
      itemId: payload.itemId ?? null,
      price: payload.price ?? null,
      originalPrice: payload.originalPrice ?? null,
      freeEligible: !!payload.freeEligible,
    },
    sources: collectSources(node),
  };
}

function buildShopLeaveStep(node) {
  return {
    kind: 'shop_leave',
    seq: node.seq,
    actor: null,
    target: null,
    refs: {},
    data: {},
    sources: collectSources(node),
  };
}

function markRepresented(represented, ...nodes) {
  for (const node of nodes) {
    if (node) represented.add(node.key);
  }
}

export function buildRenderStepsFromTimeline(timeline = []) {
  const graph = buildTimelineGraph(timeline);
  const steps = [];
  const represented = new Set();

  for (const node of graph.nodes) {
    if (represented.has(node.key)) continue;

    switch (node.entry?.event) {
      case 'battle:start':
        steps.push(buildBattleStartStep(node));
        markRepresented(represented, node);
        break;

      case 'player:turn:start':
      case 'player:turn:end':
      case 'actor:turn:start': {
        const step = buildTurnBoundaryStep(node);
        if (step) steps.push(step);
        markRepresented(represented, node);
        break;
      }

      case 'card:play':
        steps.push(buildCardPlayStep(node));
        markRepresented(represented, node);
        break;

      case 'entity:attack': {
        const chain = resolveAttackChain(node);
        steps.push(buildAttackStep(chain));
        markRepresented(represented, chain.attackNode, chain.damageNode, chain.lossNode, chain.dieNode);
        break;
      }

      case 'entity:damage': {
        const chain = resolveDamageChain(node);
        steps.push(buildDamageStep(chain));
        markRepresented(represented, chain.damageNode, chain.lossNode, chain.dieNode);
        break;
      }

      case 'entity:loss': {
        const dieNode = findBridgeChild(node, 'entity:die', 'core:entity:die:emitter', getPayload(node));
        steps.push(buildLossStep(node, dieNode));
        markRepresented(represented, node, dieNode);
        break;
      }

      case 'enemy:action':
        steps.push(buildEnemyActionStep(node));
        markRepresented(represented, node);
        break;

      case 'status:apply':
      case 'status:remove': {
        const step = buildStatusStep(node);
        if (step) steps.push(step);
        markRepresented(represented, node);
        break;
      }

      case 'card:move':
      case 'card:system:move':
        steps.push(buildCardMoveStep(node));
        markRepresented(represented, node);
        break;

      case 'entity:heal':
        steps.push(buildHealStep(node));
        markRepresented(represented, node);
        break;

      case 'entity:block': {
        const step = buildBlockStep(node);
        if (step) steps.push(step);
        markRepresented(represented, node);
        break;
      }

      case 'battle:end':
        steps.push(buildBattleEndStep(node));
        markRepresented(represented, node);
        break;

      case 'reward:open':
        steps.push(buildRewardOpenStep(node));
        markRepresented(represented, node);
        break;

      case 'reward:claim':
        steps.push(buildRewardClaimStep(node));
        markRepresented(represented, node);
        break;

      case 'reward:skip':
        steps.push(buildRewardSkipStep(node));
        markRepresented(represented, node);
        break;

      case 'shop:enter':
        steps.push(buildShopEnterStep(node));
        markRepresented(represented, node);
        break;

      case 'shop:buy':
        steps.push(buildShopBuyStep(node));
        markRepresented(represented, node);
        break;

      case 'shop:leave':
        steps.push(buildShopLeaveStep(node));
        markRepresented(represented, node);
        break;

      default:
        break;
    }
  }

  return steps;
}

function cloneSteps(steps = []) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step) => ({
    ...step,
    refs: (step?.refs && typeof step.refs === 'object') ? { ...step.refs } : {},
    data: (step?.data && typeof step.data === 'object') ? shallowClone(step.data) : {},
    sources: Array.isArray(step?.sources) ? step.sources.map((source) => ({ ...source })) : [],
  }));
}

export function buildRenderResolution(resolution = null) {
  if (!resolution || typeof resolution !== 'object') return resolution;

  const timeline = cloneTimeline(resolution?.debug?.timeline ?? []);
  const steps = timeline.length > 0
    ? buildRenderStepsFromTimeline(timeline)
    : cloneSteps(resolution.steps ?? []);

  return {
    ...resolution,
    steps,
  };
}
