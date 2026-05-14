const STARTER_SCENARIO = {
  id: 'starter',
  name: '启程',
  lang: 'zh',
  player: { hp: 75, maxHp: 75, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
  deck: [
    'mulligan',
    'draw_strength',
    'volatile_essence',
    'discard_flame',
    'time_echo',
    'chaos_gamble',
    'shuffle_blast',
    'restore',
    'mirror_image',
    'bloodletting',
  ],
  run: { gold: 100, relics: [] },
  route: {
    id: 'starter',
    name: '启程',
    floors: [
      {
        id: 'goblin_camp',
        label: '哥布林营地',
        battle: {
          enemies: [
            { typeId: 'jaw_worm', hp: 42, maxHp: 42 },
          ],
        },
        afterBattle: ['reward', 'shop'],
      },
      {
        id: 'forest_path',
        label: '森林小径',
        battle: {
          enemies: [
            { typeId: 'forest_wolf', hp: 55, maxHp: 55 },
            { typeId: 'louse_red', hp: 28, maxHp: 28 },
          ],
        },
        afterBattle: ['reward', 'shop'],
      },
      {
        id: 'boss_chamber',
        label: 'Boss 密室',
        battle: {
          enemies: [
            { typeId: 'plague_mage', hp: 100, maxHp: 100 },
            { typeId: 'iron_golem', hp: 140, maxHp: 140 },
          ],
        },
        afterBattle: [],
      },
    ],
  },
}

const BUILT_IN_SCENARIOS = {
  starter: STARTER_SCENARIO,
}

export function listBuiltInScenarios() {
  return Object.keys(BUILT_IN_SCENARIOS).sort()
}

export function loadBuiltInScenario(name = 'starter') {
  const scenario = BUILT_IN_SCENARIOS[name]
  return scenario ?? null
}
