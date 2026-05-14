import { describe, expect, it } from 'vitest';

import { ProjectedViewRuntime } from '../../../src/runtime/core/ProjectedViewRuntime.js';

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('ProjectedViewRuntime', () => {
  it('clones the initial view state and renders it as stage state', () => {
    const renders = [];
    const runtime = new ProjectedViewRuntime({
      cloneState,
      renderProjection: (visibleState, context, options) => {
        renders.push({
          visibleState: cloneState(visibleState),
          context: cloneState({
            viewState: context.viewState,
            transitionViewState: context.transitionViewState,
            uiViewState: context.uiViewState,
            stageState: context.stageState,
          }),
          options,
        });
      },
    });

    const initialState = {
      phase: 'battle',
      turn: 1,
      player: { hp: 70 },
      piles: { draw: 5, discard: 0, exhaust: 0 },
    };

    runtime.setInitialState(initialState, { tag: 'init' });
    initialState.player.hp = 1;

    expect(runtime.getViewState()).toEqual({
      phase: 'battle',
      turn: 1,
      player: { hp: 70 },
      piles: { draw: 5, discard: 0, exhaust: 0 },
    });
    expect(runtime.getStageState()).toEqual(runtime.getViewState());
    expect(renders).toHaveLength(1);
    expect(renders[0]).toMatchObject({
      visibleState: {
        phase: 'battle',
        turn: 1,
        player: { hp: 70 },
        piles: { draw: 5, discard: 0, exhaust: 0 },
      },
      context: {
        viewState: {
          phase: 'battle',
          turn: 1,
          player: { hp: 70 },
          piles: { draw: 5, discard: 0, exhaust: 0 },
        },
        transitionViewState: null,
        uiViewState: {
          phase: 'battle',
          turn: 1,
          player: { hp: 70 },
          piles: { draw: 5, discard: 0, exhaust: 0 },
        },
        stageState: {
          phase: 'battle',
          turn: 1,
          player: { hp: 70 },
          piles: { draw: 5, discard: 0, exhaust: 0 },
        },
      },
      options: { tag: 'init' },
    });
  });

  it('retains the previous ui view state during flow transactions until commit', () => {
    const renders = [];
    const runtime = new ProjectedViewRuntime({
      cloneState,
      shouldRetainPreviousViewState: (step) => step.kind === 'reward_open',
      applyRenderPatch: (stageState, step, viewState) => {
        stageState.phase = viewState.phase;
        stageState.reward = cloneState(viewState.reward);
        stageState.marker = step.kind;
      },
      renderProjection: (visibleState, context, options) => {
        renders.push({
          visibleState: cloneState(visibleState),
          context: cloneState({
            viewState: context.viewState,
            transitionViewState: context.transitionViewState,
            uiViewState: context.uiViewState,
            stageState: context.stageState,
          }),
          options,
        });
      },
    });

    const battleState = {
      phase: 'battle',
      turn: 2,
      player: { hp: 61 },
      piles: { draw: 3, discard: 2, exhaust: 0 },
    };
    const rewardState = {
      phase: 'reward',
      turn: 2,
      player: { hp: 61 },
      reward: { entries: [{ key: 'gold', kind: 'gold', amount: 14 }] },
      piles: { draw: 3, discard: 2, exhaust: 0 },
    };

    runtime.setInitialState(battleState);
    runtime.beginTransaction({
      resolution: { steps: [{ kind: 'reward_open' }] },
      afterState: rewardState,
    });

    expect(runtime.getViewState()).toEqual(rewardState);
    expect(runtime.getTransitionViewState()).toEqual(battleState);
    expect(runtime.getUiViewState()).toEqual(battleState);
    expect(runtime.getStageState()).toEqual(battleState);

    runtime.applyStepPatch({ kind: 'reward_open' }, { tag: 'patch' });

    expect(runtime.getStageState()).toMatchObject({
      phase: 'reward',
      marker: 'reward_open',
      reward: { entries: [{ key: 'gold', kind: 'gold', amount: 14 }] },
    });
    expect(renders.at(-1)).toMatchObject({
      visibleState: {
        phase: 'reward',
        marker: 'reward_open',
      },
      context: {
        viewState: rewardState,
        transitionViewState: battleState,
        uiViewState: battleState,
      },
      options: { tag: 'patch' },
    });

    runtime.commitTransaction({ tag: 'commit' });

    expect(runtime.getTransitionViewState()).toBeNull();
    expect(runtime.getUiViewState()).toEqual(rewardState);
    expect(runtime.getStageState()).toEqual(rewardState);
    expect(renders.at(-1)).toMatchObject({
      visibleState: rewardState,
      context: {
        viewState: rewardState,
        transitionViewState: null,
        uiViewState: rewardState,
        stageState: rewardState,
      },
      options: { tag: 'commit' },
    });
  });

  it('can release the retained ui view state before commit', () => {
    const runtime = new ProjectedViewRuntime({
      cloneState,
      shouldRetainPreviousViewState: (step) => step.kind === 'shop_leave',
    });

    const shopState = {
      phase: 'shop',
      turn: 2,
      player: { hp: 61 },
      shop: { stock: [{ index: 0, type: 'card' }] },
      piles: { draw: 3, discard: 2, exhaust: 0 },
    };
    const battleState = {
      phase: 'battle',
      turn: 1,
      player: { hp: 61 },
      enemies: [{ entityId: 'slime_1', hp: 24 }],
      piles: { draw: 5, discard: 0, exhaust: 0 },
    };

    runtime.setInitialState(shopState);
    runtime.beginTransaction({
      resolution: { steps: [{ kind: 'shop_leave' }, { kind: 'turn_start', actor: 'player' }] },
      afterState: battleState,
    });

    expect(runtime.getTransitionViewState()).toEqual(shopState);
    expect(runtime.getUiViewState()).toEqual(shopState);
    expect(runtime.releaseTransitionViewState()).toBe(true);
    expect(runtime.getTransitionViewState()).toBeNull();
    expect(runtime.getUiViewState()).toEqual(battleState);
    expect(runtime.releaseTransitionViewState()).toBe(false);
  });

  it('rebuilds stage state immediately for empty transactions', () => {
    const renders = [];
    const runtime = new ProjectedViewRuntime({
      cloneState,
      renderProjection: (visibleState, _context, options) => {
        renders.push({
          visibleState: cloneState(visibleState),
          options,
        });
      },
    });

    runtime.setInitialState({ phase: 'battle', turn: 1 });
    runtime.beginTransaction({
      resolution: { steps: [] },
      afterState: { phase: 'battle', turn: 2 },
    }, { tag: 'empty' });

    expect(runtime.getTransitionViewState()).toBeNull();
    expect(runtime.getStageState()).toEqual({ phase: 'battle', turn: 2 });
    expect(renders.at(-1)).toEqual({
      visibleState: { phase: 'battle', turn: 2 },
      options: { tag: 'empty' },
    });
  });
});
