const DEFAULT_GAME_PHASE = 'battle';

export function isRewardPhase(state = {}) {
  return state.phase === 'reward';
}

export function isShopPhase(state = {}) {
  return state.phase === 'shop';
}

export function hasBattleScope(state = {}) {
  return !!state?.battle && typeof state.battle === 'object' && !Array.isArray(state.battle);
}

export function isBattleActive(state = {}) {
  return hasBattleScope(state) && state.battle?.over !== true;
}

export function resolveGamePhase(state = {}) {
  return (typeof state?.phase === 'string' && state.phase.length > 0)
    ? state.phase
    : DEFAULT_GAME_PHASE;
}

// ── Phase 状态机定义 ─────────────────────────────────────────────────────────

export const PHASES = {
  battle: 'battle',
  reward: 'reward',
  shop:   'shop',
  defeat: 'defeat',
};

export const PHASE_MACHINE = {
  [PHASES.battle]: {
    commands:   ['play_card', 'end_turn', 'discard_card'],
    checkpoints: { phaseCheckpoint: 'capture', turnCheckpoint: 'capture' },
  },
  [PHASES.reward]: {
    commands:   ['claim_reward', 'skip_reward'],
    checkpoints: { phaseCheckpoint: 'capture', turnCheckpoint: 'clear' },
  },
  [PHASES.shop]: {
    commands:   ['buy_shop_item', 'leave_shop'],
    checkpoints: { phaseCheckpoint: 'capture', turnCheckpoint: 'clear' },
  },
  [PHASES.defeat]: {
    commands:   [],
    checkpoints: { phaseCheckpoint: 'capture', turnCheckpoint: 'clear' },
  },
};

export const PHASE_COMMAND_REASONS = {
  claim_reward:  'not_in_reward',
  skip_reward:   'not_in_reward',
  buy_shop_item: 'not_in_shop',
  leave_shop:    'not_in_shop',
};

export function getPhaseCommands(phase) {
  return PHASE_MACHINE[phase]?.commands ?? [];
}

export function getPhaseCheckpoints(phase) {
  return PHASE_MACHINE[phase]?.checkpoints ?? { phaseCheckpoint: 'capture', turnCheckpoint: 'clear' };
}
