export const BATTLE_MODES = {
  loading: 'loading',
  idle: 'idle',
  targeting: 'targeting',
  animating: 'animating',
  flow: 'flow',
  paused: 'paused',
  battleOver: 'battle-over',
};

export function isBlockedBattleMode(mode) {
  return mode === BATTLE_MODES.loading
    || mode === BATTLE_MODES.animating
    || mode === BATTLE_MODES.flow
    || mode === BATTLE_MODES.paused
    || mode === BATTLE_MODES.battleOver;
}

