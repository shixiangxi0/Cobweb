

const RUN_TRANSIENT = ['statuses', 'energy'];
const RUN_CORE = ['gold', 'relics', 'potions', 'deck', 'player'];

function cloneLoose(value) {
  if (Array.isArray(value)) return value.slice();
  if (value && typeof value === 'object') return { ...value };
  return value;
}

function cloneDeck(deck = []) {
  return deck.map(e => (typeof e === 'string' ? e : { ...e }));
}

function cloneStatusMap(statuses = {}) {
  const next = {};
  for (const [k, v] of Object.entries(statuses)) next[k] = cloneLoose(v);
  return next;
}

function cloneDurablePlayer(player = {}) {
  const next = { ...player };
  for (const k of RUN_TRANSIENT) delete next[k];
  for (const [k, v] of Object.entries(next)) next[k] = cloneLoose(v);
  return next;
}

function cloneBattleOverrides(player = {}) {
  const o = {};
  if (player.energy != null) o.energy = player.energy;
  if (player.statuses) o.statuses = cloneStatusMap(player.statuses);
  return o;
}

function instantiateBattlePlayer({ persistentPlayer = {}, initialPlayer = {}, character = {} } = {}) {
  const battlePlayer = {
    ...(character.baseStats ?? {}),
    ...cloneDurablePlayer(persistentPlayer),
    ...cloneBattleOverrides(initialPlayer),
  };
  if (initialPlayer?.energy == null && battlePlayer.maxEnergy != null) {
    battlePlayer.energy = battlePlayer.maxEnergy;
  }
  battlePlayer.statuses = cloneStatusMap(battlePlayer.statuses);
  return battlePlayer;
}

function cloneRunExtras(run = {}) {
  const extras = {};
  for (const [k, v] of Object.entries(run)) {
    if (RUN_CORE.includes(k)) continue;
    extras[k] = cloneLoose(v);
  }
  return extras;
}

function buildPersistentBindings(run = {}) {
  const bindings = {};
  for (const relicId of run.relics ?? []) {
    if (typeof relicId !== 'string' || relicId.length === 0) continue;
    bindings[`relic_${relicId}`] = { kind: 'relic', id: relicId, ctx: {} };
  }
  return Object.keys(bindings).length > 0 ? bindings : null;
}

/**
 * @param {object} opts
 * @param {object} opts.initial    语义化战斗参数
 * @param {object} opts.run        持久化 run 真相（deck / gold / relics / player）
 * @param {object} opts.cards      卡牌定义字典 id → def
 * @param {object} opts.character  角色定义（含 baseStats）
 * @returns {object} 完整 store 对象，可直接传给 engine.load
 */
export function buildBattleStore({ initial = {}, run = {}, cards = {}, character = {} }) {
  const persistentPlayer = cloneDurablePlayer(
    Object.keys(run.player ?? {}).length > 0
      ? run.player
      : { ...(character.baseStats ?? {}), ...(initial.player ?? {}) },
  );
  const persistentDeck = cloneDeck(run.deck ?? initial.deck ?? []);
  const battleDeck = cloneDeck(initial.deck ?? persistentDeck);
  const battlePlayer = instantiateBattlePlayer({
    persistentPlayer,
    initialPlayer: initial.player ?? {},
    character,
  });

  // ── 牌堆：将语义卡牌列表转为实例字典 + 有序 id 列表 ──────────────────────
  const cardEntities = {};
  const deckIds = [];
  const seenIds = {};
  for (const c of battleDeck) {
    const { cardId, instanceId, ...overrides } = typeof c === 'string' ? { cardId: c } : c;
    seenIds[cardId] = (seenIds[cardId] ?? 0) + 1;
    const iid = instanceId ?? `${cardId}_${seenIds[cardId]}`;
    // 只保留运行时数据字段，剥离定义层字段（hooks / display）
    const { hooks: _, display: __, ...baseData } = cards[cardId] ?? {};
    cardEntities[iid] = { cardId, ...baseData, ...overrides };
    deckIds.push(iid);
  }

  // ── 敌人：slot → entityId 映射 + 实体数据 ────────────────────────────────
  const entities = { player: battlePlayer };
  const enemySlots = {};
  for (const [slot, e] of Object.entries(initial.enemies ?? {})) {
    if (!e) { enemySlots[slot] = null; continue; }
    const eid = `${e.typeId}_${slot}`;
    entities[eid] = { typeId: e.typeId, hp: e.hp, maxHp: e.maxHp ?? e.hp, statuses: {} };
    enemySlots[slot] = eid;
  }

  const persistentBindings = buildPersistentBindings(run);

  return {
    battle: {
      enemies: enemySlots,
      entities,
      cards: cardEntities,
      drawPile: deckIds,
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 0,
    },
    ...(persistentBindings && { _bindings: persistentBindings }),
    run:    {
      gold: run.gold ?? 0,
      relics: [...(run.relics ?? [])],
      potions: [...(run.potions ?? [])],
      deck: persistentDeck,
      player: persistentPlayer,
      ...cloneRunExtras(run),
    },
    phase:  'battle',
    shop:   null,
    reward: null,
  };
}

export function buildRunState({ initial = {}, scenario = {}, character = {}, progress = null } = {}) {
  const scenarioRun = scenario.run ?? {};
  return {
    gold: initial.gold ?? scenarioRun.gold ?? 0,
    relics: [...(initial.relics ?? scenarioRun.relics ?? [])],
    potions: [...(initial.potions ?? scenarioRun.potions ?? [])],
    deck: cloneDeck(initial.deck ?? scenarioRun.deck ?? scenario.deck ?? []),
    player: cloneDurablePlayer({
      ...(character.baseStats ?? {}),
      ...(scenario.player ?? {}),
      ...(scenarioRun.player ?? {}),
      ...(initial.player ?? {}),
    }),
    ...(progress && { progress: cloneLoose(progress) }),
  };
}
