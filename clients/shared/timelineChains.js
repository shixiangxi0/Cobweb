/**
 * timelineChains.js — timeline 解析辅助函数
 *
 * 被 summarize.js 和 renderStepInterpreter.js 共享。
 */

export function getPayload(node) {
  return node?.entry?.payload ?? {};
}

export function sameImpactRef(left = {}, right = {}) {
  return (left.target ?? null) === (right.target ?? null)
    && (left.source ?? null) === (right.source ?? null)
    && (left.action ?? null) === (right.action ?? null)
    && (left.cardId ?? null) === (right.cardId ?? null)
    && (left.instanceId ?? null) === (right.instanceId ?? null);
}

export function findBridgeChild(node, event, causeBy, fallbackPayload = null) {
  const children = node?.children ?? [];
  return children.find((child) => child.entry?.event === event && child.entry?.causeBy === causeBy)
    ?? children.find((child) => child.entry?.event === event && (fallbackPayload == null || sameImpactRef(getPayload(child), fallbackPayload)))
    ?? children.find((child) => child.entry?.event === event)
    ?? null;
}

export function resolveDamageChain(damageNode) {
  if (!damageNode) {
    return { damageNode: null, lossNode: null, dieNode: null };
  }

  const damagePayload = getPayload(damageNode);
  const lossNode = findBridgeChild(damageNode, 'entity:loss', 'core:entity:damage:loss', damagePayload);
  const lossPayload = getPayload(lossNode);
  const dieNode = findBridgeChild(lossNode, 'entity:die', 'core:entity:die:emitter', lossPayload);
  return { damageNode, lossNode, dieNode };
}

export function resolveAttackChain(attackNode) {
  if (!attackNode) {
    return { attackNode: null, damageNode: null, lossNode: null, dieNode: null };
  }

  const attackPayload = getPayload(attackNode);
  const damageNode = findBridgeChild(attackNode, 'entity:damage', 'core:entity:attack', attackPayload);
  return {
    attackNode,
    ...resolveDamageChain(damageNode),
  };
}
