function normalizeBattleEnemies(enemies = []) {
  return enemies
    .map((enemy) => {
      if (!enemy?.typeId) return null;
      const hp = enemy.hp ?? enemy.maxHp ?? 1;
      const maxHp = enemy.maxHp ?? hp;
      return { typeId: enemy.typeId, hp, maxHp };
    })
    .filter(Boolean);
}

function normalizePhaseExitList(source = null) {
  const values = Array.isArray(source) ? source : ['reward', 'shop'];
  return values
    .filter((phase) => typeof phase === 'string' && phase.length > 0);
}

function normalizeFloor(source = {}, fallbackScenario = {}, index = 0) {
  const battle = source.battle ?? {};

  return {
    id: source.id ?? `floor_${index + 1}`,
    label: source.label ?? source.name ?? `第 ${index + 1} 层`,
    afterBattle: normalizePhaseExitList(source.afterBattle),
    battle: {
      player: battle.player ?? source.player ?? {},
      deck: battle.deck ?? source.deck ?? null,
      enemies: normalizeBattleEnemies(
        battle.enemies
        ?? source.enemies
        ?? fallbackScenario.enemies
        ?? [],
      ),
    },
  };
}

export function normalizeScenarioRoute(scenario = {}) {
  const configuredFloors = Array.isArray(scenario.route?.floors) && scenario.route.floors.length > 0
    ? scenario.route.floors
    : [scenario];

  return {
    id: scenario.route?.id ?? scenario.id ?? 'route',
    name: scenario.route?.name ?? scenario.name ?? '远征',
    floors: configuredFloors.map((floor, index) => normalizeFloor(floor, scenario, index)),
  };
}

function clampFloorIndex(route, floorIndex = 0) {
  const floorCount = route?.floors?.length ?? 0;
  if (floorCount <= 0) return 0;
  const numeric = Number.isFinite(floorIndex) ? Math.trunc(floorIndex) : 0;
  return Math.max(0, Math.min(numeric, floorCount - 1));
}

export function buildRouteProgress(route, floorIndex = 0, { completed = false } = {}) {
  const nextIndex = clampFloorIndex(route, floorIndex);
  const currentFloor = route?.floors?.[nextIndex] ?? null;

  return {
    routeId: route?.id ?? null,
    routeName: route?.name ?? null,
    floorIndex: nextIndex,
    floorCount: route?.floors?.length ?? 0,
    floorId: currentFloor?.id ?? null,
    floorLabel: currentFloor?.label ?? null,
    completed: !!completed,
  };
}

export function resolveRouteFloor(route, progress = null) {
  if (!route?.floors?.length) return null;
  const floorIndex = clampFloorIndex(route, progress?.floorIndex ?? 0);
  return route.floors[floorIndex] ?? null;
}

export function resolveNextRouteFloor(route, progress = null) {
  if (!route?.floors?.length) return null;
  const nextIndex = clampFloorIndex(route, (progress?.floorIndex ?? 0) + 1);
  if ((progress?.floorIndex ?? 0) + 1 >= route.floors.length) return null;
  return route.floors[nextIndex] ?? null;
}
