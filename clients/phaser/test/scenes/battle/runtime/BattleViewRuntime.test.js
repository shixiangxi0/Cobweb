import { describe, expect, it } from 'vitest';

import { BATTLE_MODES } from '../../../../scenes/battle/state/battleModeState.js';
import { BattleViewRuntime } from '../../../../scenes/battle/runtime/BattleViewRuntime.js';

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function createBattleViewState(overrides = {}) {
  return {
    phase: 'battle',
    turn: 1,
    over: false,
    victory: false,
    player: {
      hp: 70,
      maxHp: 70,
      energy: 3,
      maxEnergy: 3,
      block: 0,
      statuses: {},
    },
    enemies: [],
    hand: [{ instanceId: 'card_1', cardId: 'strike', cost: 1 }],
    piles: { draw: 4, discard: 0, exhaust: 0 },
    run: { gold: 99, relics: [] },
    ...overrides,
  };
}

describe('BattleViewRuntime', () => {
  it('projects battle view state into the battle sync callbacks', () => {
    const calls = {
      hud: [],
      stage: [],
      piles: [],
      hand: [],
      backdrop: [],
      phaseUi: [],
      refreshCount: 0,
    };
    const runtime = new BattleViewRuntime({
      cloneState,
      syncHud: (viewState) => calls.hud.push(cloneState(viewState)),
      syncStage: (viewState) => calls.stage.push(cloneState(viewState)),
      syncPiles: (piles) => calls.piles.push(cloneState(piles)),
      syncHand: (hand, options) => calls.hand.push({ hand: cloneState(hand), options: { ...options } }),
      syncBackdrop: (viewState) => calls.backdrop.push(cloneState(viewState)),
      syncPhaseUi: (viewState) => calls.phaseUi.push(cloneState(viewState)),
      refreshInteractivity: () => {
        calls.refreshCount += 1;
      },
    });

    const initialState = createBattleViewState();
    runtime.setInitialState(initialState, { immediateHand: true });

    expect(calls.hud).toEqual([initialState]);
    expect(calls.stage).toEqual([initialState]);
    expect(calls.piles).toEqual([initialState.piles]);
    expect(calls.hand).toEqual([
      {
        hand: initialState.hand,
        options: { immediate: true },
      },
    ]);
    expect(calls.backdrop).toEqual([initialState]);
    expect(calls.phaseUi).toEqual([initialState]);
    expect(calls.refreshCount).toBe(1);
    expect(runtime.getSteadyMode()).toBe(BATTLE_MODES.idle);
    expect(runtime.getCurrentTurn()).toBe(1);
  });

  it('keeps the previous phase ui state during flow transactions until commit', () => {
    const phaseUiPhases = [];
    const backdropPhases = [];
    const hudPhases = [];
    const stagePhases = [];
    const pilesValues = [];
    const handValues = [];
    const handOptions = [];
    const runtime = new BattleViewRuntime({
      cloneState,
      isFlowStep: (step) => step.kind === 'reward_open',
      applyRenderPatch: (stageState, _step, viewState) => {
        stageState.phase = viewState.phase;
        stageState.reward = cloneState(viewState.reward);
      },
      syncHud: (viewState) => hudPhases.push(viewState.phase),
      syncStage: (viewState) => stagePhases.push(viewState.phase),
      syncPiles: (piles) => pilesValues.push(cloneState(piles)),
      syncHand: (hand, options) => {
        handValues.push(cloneState(hand));
        handOptions.push({ ...options });
      },
      syncBackdrop: (viewState) => backdropPhases.push(viewState.phase),
      syncPhaseUi: (viewState) => phaseUiPhases.push(viewState.phase),
      refreshInteractivity: () => {},
    });

    const battleState = createBattleViewState({ phase: 'battle' });
    const rewardState = {
      phase: 'reward',
      over: true,
      victory: true,
      run: { gold: 99, relics: [] },
      reward: { entries: [{ key: 'gold', kind: 'gold', amount: 12 }] },
    };

    runtime.setInitialState(battleState);
    phaseUiPhases.length = 0;
    backdropPhases.length = 0;
    hudPhases.length = 0;
    stagePhases.length = 0;
    pilesValues.length = 0;
    handValues.length = 0;
    handOptions.length = 0;

    runtime.beginTransaction({
      resolution: { steps: [{ kind: 'reward_open' }] },
      afterState: rewardState,
    });

    expect(runtime.getFlowViewState()).toEqual(battleState);
    expect(runtime.getPhaseUiState()).toEqual(battleState);

    runtime.applyStepPatch({ kind: 'reward_open' }, { immediateHand: false });

    expect(runtime.getStageState()).toMatchObject({
      phase: 'reward',
      reward: { entries: [{ key: 'gold', kind: 'gold', amount: 12 }] },
    });
    expect(hudPhases.at(-1)).toBe('battle');
    expect(stagePhases.at(-1)).toBe('battle');
    expect(pilesValues.at(-1)).toEqual(battleState.piles);
    expect(handValues.at(-1)).toEqual(battleState.hand);
    expect(phaseUiPhases.at(-1)).toBe('battle');
    expect(backdropPhases.at(-1)).toBe('reward');
    expect(handOptions.at(-1)).toEqual({ immediate: false });

    runtime.commitTransaction({ immediateHand: false });

    expect(runtime.getFlowViewState()).toBeNull();
    expect(runtime.getPhaseUiState()).toEqual(rewardState);
    expect(hudPhases.at(-1)).toBe('battle');
    expect(stagePhases.at(-1)).toBe('battle');
    expect(phaseUiPhases.at(-1)).toBe('reward');
    expect(runtime.getSteadyMode()).toBe(BATTLE_MODES.flow);
  });

  it('can release retained phase ui state after a flow exit animation', () => {
    const phaseUiPhases = [];
    const runtime = new BattleViewRuntime({
      cloneState,
      isFlowStep: (step) => step.kind === 'shop_leave',
      applyRenderPatch: (stageState, step, viewState) => {
        if (step.kind === 'turn_start') {
          stageState.turn = viewState.turn;
          stageState.phase = viewState.phase;
        }
      },
      syncHud: () => {},
      syncStage: () => {},
      syncPiles: () => {},
      syncHand: () => {},
      syncBackdrop: () => {},
      syncPhaseUi: (viewState) => phaseUiPhases.push(viewState.phase),
      refreshInteractivity: () => {},
    });

    const shopState = createBattleViewState({
      phase: 'shop',
      shop: { shelves: [] },
    });
    const battleState = createBattleViewState({
      phase: 'battle',
      turn: 3,
      enemies: [{ entityId: 'slime_1', hp: 24, maxHp: 24, block: 0, statuses: {} }],
    });

    runtime.setInitialState(shopState);
    phaseUiPhases.length = 0;

    runtime.beginTransaction({
      resolution: { steps: [{ kind: 'shop_leave' }, { kind: 'turn_start', actor: 'player' }] },
      afterState: battleState,
    });

    expect(runtime.getFlowViewState()).toEqual(shopState);
    expect(runtime.getPhaseUiState()).toEqual(shopState);

    expect(runtime.releaseTransitionViewState()).toBe(true);
    expect(runtime.getFlowViewState()).toBeNull();
    expect(runtime.getPhaseUiState()).toEqual(battleState);

    runtime.applyStepPatch({ kind: 'turn_start', actor: 'player' }, { immediateHand: false });

    expect(phaseUiPhases.at(-1)).toBe('battle');
  });

  it('derives loading, flow, and battle-over steady modes from the current view state', () => {
    const runtime = new BattleViewRuntime();
    expect(runtime.getSteadyMode()).toBe(BATTLE_MODES.loading);

    runtime.setInitialState(createBattleViewState({ phase: 'shop' }));
    expect(runtime.getSteadyMode()).toBe(BATTLE_MODES.flow);

    runtime.setInitialState(createBattleViewState({ phase: 'battle', over: true, victory: true }));
    expect(runtime.getSteadyMode()).toBe(BATTLE_MODES.battleOver);
  });
});
