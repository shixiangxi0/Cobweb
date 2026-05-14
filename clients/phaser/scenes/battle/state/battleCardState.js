export const CARD_STATES = {
  idle: 'idle',
  hover: 'hover',
  targeting: 'targeting',
  drag: 'drag',
  resolving: 'resolving',
  discarding: 'discarding',
  exhausting: 'exhausting',
};

const TRANSIENT_CARD_STATES = new Set([
  CARD_STATES.resolving,
  CARD_STATES.discarding,
  CARD_STATES.exhausting,
]);

const RAISED_CARD_STATES = new Set([
  CARD_STATES.hover,
  CARD_STATES.targeting,
]);

const ZONE_TRANSITION_CARD_STATES = new Set([
  CARD_STATES.discarding,
  CARD_STATES.exhausting,
]);

const CARD_STATE_GRAPH = {
  [CARD_STATES.idle]: new Set([
    CARD_STATES.hover,
    CARD_STATES.targeting,
    CARD_STATES.drag,
    CARD_STATES.resolving,
  ]),
  [CARD_STATES.hover]: new Set([
    CARD_STATES.idle,
    CARD_STATES.drag,
    CARD_STATES.targeting,
    CARD_STATES.resolving,
  ]),
  [CARD_STATES.targeting]: new Set([
    CARD_STATES.idle,
    CARD_STATES.drag,
    CARD_STATES.resolving,
  ]),
  [CARD_STATES.drag]: new Set([
    CARD_STATES.idle,
    CARD_STATES.targeting,
    CARD_STATES.resolving,
  ]),
  [CARD_STATES.resolving]: new Set([
    CARD_STATES.discarding,
    CARD_STATES.exhausting,
  ]),
  [CARD_STATES.discarding]: new Set(),
  [CARD_STATES.exhausting]: new Set(),
};

export function isTransientCardState(state) {
  return TRANSIENT_CARD_STATES.has(state);
}

export function isHandCardState(state) {
  return !!state && !TRANSIENT_CARD_STATES.has(state);
}

export function isRaisedCardState(state) {
  return RAISED_CARD_STATES.has(state);
}

export function isZoneTransitionCardState(state) {
  return ZONE_TRANSITION_CARD_STATES.has(state);
}

export function canTransitionCardState(prevState, nextState) {
  if (!prevState || !nextState) return false;
  if (prevState === nextState) return true;
  return CARD_STATE_GRAPH[prevState]?.has(nextState) ?? false;
}

