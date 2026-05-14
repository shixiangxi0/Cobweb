function getBundleIndex(entry = {}) {
  return Number.isInteger(entry.bundleIndex) ? entry.bundleIndex : 0;
}

function getTimelineSeq(entry = {}, fallbackIndex = 0) {
  return Number.isFinite(entry.seq) ? entry.seq : fallbackIndex;
}

export function compareTimelinePosition(left = {}, right = {}, leftIndex = 0, rightIndex = 0) {
  const bundleDiff = getBundleIndex(left) - getBundleIndex(right);
  if (bundleDiff !== 0) return bundleDiff;

  const seqDiff = getTimelineSeq(left, leftIndex) - getTimelineSeq(right, rightIndex);
  if (seqDiff !== 0) return seqDiff;

  return leftIndex - rightIndex;
}

export function sortTimeline(entries = []) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => compareTimelinePosition(a.entry, b.entry, a.index, b.index))
    .map(({ entry }) => entry);
}

export function buildTimelineNodeKey(entry = {}, index = 0) {
  return `${getBundleIndex(entry)}:${getTimelineSeq(entry, index)}`;
}

function resolveTimelineNode(byKey, ref) {
  if (ref == null) return null;
  if (typeof ref === 'string') return byKey.get(ref) ?? null;
  if (typeof ref === 'number') return byKey.get(`0:${ref}`) ?? null;
  if (typeof ref === 'object' && typeof ref.key === 'string' && ref.entry) return byKey.get(ref.key) ?? ref;
  if (typeof ref === 'object') return byKey.get(buildTimelineNodeKey(ref)) ?? null;
  return null;
}

export function buildTimelineGraph(entries = []) {
  const nodes = sortTimeline(entries).map((entry, index) => {
    const key = buildTimelineNodeKey(entry, index);
    const bundleIndex = getBundleIndex(entry);
    const seq = getTimelineSeq(entry, index);
    return {
      key,
      index,
      bundleIndex,
      seq,
      depth: Number.isFinite(entry.depth) ? entry.depth : 0,
      parentKey: Number.isFinite(entry.parentSeq) ? `${bundleIndex}:${entry.parentSeq}` : null,
      rootKey: Number.isFinite(entry.rootSeq) ? `${bundleIndex}:${entry.rootSeq}` : key,
      entry,
      parent: null,
      children: [],
    };
  });

  const byKey = new Map(nodes.map((node) => [node.key, node]));

  for (const node of nodes) {
    if (!node.parentKey) continue;
    const parent = byKey.get(node.parentKey) ?? null;
    if (!parent) continue;
    node.parent = parent;
    parent.children.push(node);
  }

  for (const node of nodes) {
    node.children.sort((a, b) => compareTimelinePosition(a.entry, b.entry, a.index, b.index));
  }

  const roots = nodes.filter((node) => node.parent == null);

  function getNode(ref) {
    return resolveTimelineNode(byKey, ref);
  }

  function getChildren(ref) {
    return getNode(ref)?.children.slice() ?? [];
  }

  function getDescendants(ref, { includeSelf = false } = {}) {
    const start = getNode(ref);
    if (!start) return [];

    const result = [];
    const stack = includeSelf
      ? [start]
      : start.children.slice().reverse();

    while (stack.length > 0) {
      const node = stack.pop();
      result.push(node);
      for (let index = node.children.length - 1; index >= 0; index--) {
        stack.push(node.children[index]);
      }
    }

    return result;
  }

  return {
    nodes,
    roots,
    byKey,
    getNode,
    getChildren,
    getDescendants,
  };
}
