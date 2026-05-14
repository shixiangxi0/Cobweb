export function setDebugName(target, name) {
  if (!target || !name) return target;
  target.setName?.(name);
  target.setData?.('debugName', name);
  return target;
}

export function getDebugName(target) {
  return target?.getData?.('debugName') ?? target?.name ?? '';
}
