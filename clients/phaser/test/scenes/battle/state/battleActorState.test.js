import { describe, expect, it } from 'vitest';

import {
  ACTOR_MOTION_STATES,
  ACTOR_TARGET_STATES,
  canSyncActorLayout,
  createActorNodeRuntime,
  resolveEnemyActorTargetState,
  setActorMotionState,
  setActorTargetState,
} from '../../../../scenes/battle/state/battleActorState.js';

describe('battleActorState', () => {
  it('creates normalized actor runtime records', () => {
    expect(createActorNodeRuntime({
      layoutX: 12,
      layoutY: 34,
      motionState: 'bad-motion',
      targetState: 'bad-target',
    })).toEqual({
      layoutX: 12,
      layoutY: 34,
      motionState: ACTOR_MOTION_STATES.idle,
      targetState: ACTOR_TARGET_STATES.idle,
    });
  });

  it('tracks motion states and only allows layout sync while stable', () => {
    const runtime = createActorNodeRuntime();

    expect(canSyncActorLayout(runtime)).toBe(true);
    expect(setActorMotionState(runtime, ACTOR_MOTION_STATES.attack)).toBe(true);
    expect(runtime.motionState).toBe(ACTOR_MOTION_STATES.attack);
    expect(canSyncActorLayout(runtime)).toBe(false);

    expect(setActorMotionState(runtime, ACTOR_MOTION_STATES.idle)).toBe(true);
    expect(canSyncActorLayout(runtime)).toBe(true);
  });

  it('tracks target states independently from motion states', () => {
    const runtime = createActorNodeRuntime();

    expect(setActorTargetState(runtime, ACTOR_TARGET_STATES.targetable)).toBe(true);
    expect(runtime.targetState).toBe(ACTOR_TARGET_STATES.targetable);
    expect(setActorTargetState(runtime, ACTOR_TARGET_STATES.hovered)).toBe(true);
    expect(runtime.targetState).toBe(ACTOR_TARGET_STATES.hovered);
  });

  it('derives enemy target state from interaction flags', () => {
    expect(resolveEnemyActorTargetState({ active: false, hovered: true })).toBe(ACTOR_TARGET_STATES.idle);
    expect(resolveEnemyActorTargetState({ active: true, hovered: false })).toBe(ACTOR_TARGET_STATES.targetable);
    expect(resolveEnemyActorTargetState({ active: true, hovered: true })).toBe(ACTOR_TARGET_STATES.hovered);
  });
});
