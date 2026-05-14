const BATTLE_ZONE_KEYS = Object.freeze(['drawPile', 'hand', 'discardPile', 'exhaustPile']);

function isNumericKey(key) {
  return /^\d+$/.test(String(key ?? ''));
}

export function coerceBattleZoneList(value = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  return Object.keys(value)
    .filter(isNumericKey)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => value[key])
    .filter((entry) => typeof entry === 'string' && entry.length > 0);
}

export function normalizeBattleRuntime(runtime = {}) {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) return {};

  const nextRuntime = { ...runtime };
  for (const key of BATTLE_ZONE_KEYS) {
    nextRuntime[key] = coerceBattleZoneList(runtime[key]);
  }
  return nextRuntime;
}

export function getBattleRuntime(state = {}) {
  return normalizeBattleRuntime(state?.battle ?? {});
}

export function getBattleEntities(state = {}) {
  return getBattleRuntime(state).entities ?? {};
}

export function getBattleEntity(state = {}, entityId = null) {
  if (!entityId) return null;
  return getBattleEntities(state)[entityId] ?? null;
}

export function getBattlePlayer(state = {}) {
  return getBattleEntity(state, 'player');
}

export function getBattleCard(state = {}, instanceId = null) {
  if (!instanceId) return null;
  return getBattleRuntime(state).cards?.[instanceId] ?? null;
}

export function getBattleHand(state = {}) {
  return coerceBattleZoneList(getBattleRuntime(state).hand);
}

export function listBattleEnemyIds(state = {}) {
  const runtime = getBattleRuntime(state);
  return Object.keys(runtime.enemies ?? {})
    .sort((left, right) => Number(left) - Number(right))
    .map((slot) => runtime.enemies?.[slot] ?? null)
    .filter((entityId) => typeof entityId === 'string' && entityId.length > 0);
}
