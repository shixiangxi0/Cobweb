const STORAGE_KEY = 'cobweb.battle.checkpoints.v1';

let memoryStore = createEmptyStore();

function createEmptyStore() {
  return {
    version: 1,
    activeBattleId: null,
    battles: {},
  };
}

function cloneValue(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function normalizeStore(store) {
  if (!store || typeof store !== 'object') return createEmptyStore();
  if (store.version !== 1) return createEmptyStore();
  if (!store.battles || typeof store.battles !== 'object') return createEmptyStore();
  return {
    version: 1,
    activeBattleId: typeof store.activeBattleId === 'string' ? store.activeBattleId : null,
    battles: store.battles,
  };
}

function readStore() {
  if (!canUseLocalStorage()) {
    return cloneValue(memoryStore) ?? createEmptyStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store) {
  const normalized = normalizeStore(store);

  if (!canUseLocalStorage()) {
    memoryStore = cloneValue(normalized) ?? createEmptyStore();
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {}
}

export function createBattleId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `battle_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveTurnStartCheckpoint({ battleId, turn, snapshot }) {
  if (!battleId || !Number.isFinite(turn) || !snapshot) return false;

  const store = readStore();
  const battle = store.battles[battleId] ?? {
    latestTurn: turn,
    turns: {},
  };

  battle.latestTurn = turn;
  battle.turns = battle.turns && typeof battle.turns === 'object' ? battle.turns : {};
  battle.turns[String(turn)] = cloneValue(snapshot);

  store.activeBattleId = battleId;
  store.battles[battleId] = battle;
  writeStore(store);
  return true;
}

export function loadTurnStartCheckpoint({ battleId, turn = null }) {
  if (!battleId) return null;

  const store = readStore();
  const battle = store.battles[battleId];
  if (!battle || typeof battle !== 'object') return null;

  const resolvedTurn = turn == null ? battle.latestTurn : turn;
  return cloneValue(battle.turns?.[String(resolvedTurn)] ?? null);
}

export function clearBattleCheckpoints(battleId) {
  if (!battleId) return;

  const store = readStore();
  if (!(battleId in store.battles)) return;

  delete store.battles[battleId];
  if (store.activeBattleId === battleId) {
    store.activeBattleId = null;
  }
  writeStore(store);
}
