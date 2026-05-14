export const ACTOR_MOTION_STATES = Object.freeze({
  idle: 'idle',
  relocating: 'relocating',
  animating: 'animating',
  attack: 'attack',
});

export const ACTOR_TARGET_STATES = Object.freeze({
  idle: 'idle',
  targetable: 'targetable',
  hovered: 'hovered',
});

const MOTION_STATE_VALUES = new Set(Object.values(ACTOR_MOTION_STATES));
const TARGET_STATE_VALUES = new Set(Object.values(ACTOR_TARGET_STATES));

const ACTOR_MOTION_STATE_GRAPH = {
  [ACTOR_MOTION_STATES.idle]: new Set([
    ACTOR_MOTION_STATES.relocating,
    ACTOR_MOTION_STATES.animating,
    ACTOR_MOTION_STATES.attack,
  ]),
  [ACTOR_MOTION_STATES.relocating]: new Set([
    ACTOR_MOTION_STATES.idle,
    ACTOR_MOTION_STATES.animating,
    ACTOR_MOTION_STATES.attack,
  ]),
  [ACTOR_MOTION_STATES.animating]: new Set([
    ACTOR_MOTION_STATES.idle,
    ACTOR_MOTION_STATES.attack,
  ]),
  [ACTOR_MOTION_STATES.attack]: new Set([
    ACTOR_MOTION_STATES.idle,
    ACTOR_MOTION_STATES.animating,
  ]),
};

const ACTOR_TARGET_STATE_GRAPH = {
  [ACTOR_TARGET_STATES.idle]: new Set([
    ACTOR_TARGET_STATES.targetable,
    ACTOR_TARGET_STATES.hovered,
  ]),
  [ACTOR_TARGET_STATES.targetable]: new Set([
    ACTOR_TARGET_STATES.idle,
    ACTOR_TARGET_STATES.hovered,
  ]),
  [ACTOR_TARGET_STATES.hovered]: new Set([
    ACTOR_TARGET_STATES.idle,
    ACTOR_TARGET_STATES.targetable,
  ]),
};

export function normalizeActorMotionState(state) {
  return MOTION_STATE_VALUES.has(state) ? state : ACTOR_MOTION_STATES.idle;
}

export function normalizeActorTargetState(state) {
  return TARGET_STATE_VALUES.has(state) ? state : ACTOR_TARGET_STATES.idle;
}

export function createActorNodeRuntime({
  layoutX = 0,
  layoutY = 0,
  motionState = ACTOR_MOTION_STATES.idle,
  targetState = ACTOR_TARGET_STATES.idle,
} = {}) {
  return {
    motionState: normalizeActorMotionState(motionState),
    targetState: normalizeActorTargetState(targetState),
    layoutX,
    layoutY,
  };
}

function canTransitionState(prevState, nextState, graph, normalize) {
  const prev = normalize(prevState);
  const next = normalize(nextState);
  if (prev === next) return true;
  return graph[prev]?.has(next) ?? false;
}

function setActorState(runtime, key, nextState, normalize, graph) {
  if (!runtime) return false;
  const next = normalize(nextState);
  const prev = normalize(runtime[key]);
  if (!canTransitionState(prev, next, graph, normalize)) return false;
  runtime[key] = next;
  return true;
}

export function canTransitionActorMotionState(prevState, nextState) {
  return canTransitionState(prevState, nextState, ACTOR_MOTION_STATE_GRAPH, normalizeActorMotionState);
}

export function canTransitionActorTargetState(prevState, nextState) {
  return canTransitionState(prevState, nextState, ACTOR_TARGET_STATE_GRAPH, normalizeActorTargetState);
}

export function setActorMotionState(runtime, nextState) {
  return setActorState(runtime, 'motionState', nextState, normalizeActorMotionState, ACTOR_MOTION_STATE_GRAPH);
}

export function setActorTargetState(runtime, nextState) {
  return setActorState(runtime, 'targetState', nextState, normalizeActorTargetState, ACTOR_TARGET_STATE_GRAPH);
}

export function canSyncActorLayout(runtime) {
  const motionState = normalizeActorMotionState(runtime?.motionState);
  return motionState === ACTOR_MOTION_STATES.idle
    || motionState === ACTOR_MOTION_STATES.relocating;
}

export function resolveEnemyActorTargetState({ active = false, hovered = false } = {}) {
  if (!active) return ACTOR_TARGET_STATES.idle;
  return hovered ? ACTOR_TARGET_STATES.hovered : ACTOR_TARGET_STATES.targetable;
}
