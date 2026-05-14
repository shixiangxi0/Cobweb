import { describe, expect, it, vi } from 'vitest';

import { isBattleFlowStep, playBattleFlowStep } from '../../../../scenes/battle/animation/battleFlowBridge.js';

describe('battleFlowBridge', () => {
  it('recognizes shared flow steps and ignores battle-local steps', () => {
    expect(isBattleFlowStep({ kind: 'reward_open' })).toBe(true);
    expect(isBattleFlowStep({ kind: 'shop_leave' })).toBe(true);
    expect(isBattleFlowStep({ kind: 'attack' })).toBe(false);
  });

  it('forwards flow steps into the shared phase ui with retained-state release', async () => {
    const releaseTransitionViewState = vi.fn(() => true);
    const phaseUi = {
      playStep: vi.fn(async (_step, options) => {
        options.releaseRetainedViewState?.();
        return true;
      }),
    };
    const animQueue = { enqueueMany: vi.fn() };
    const flowViewState = { phase: 'battle', over: true, victory: true };
    const nextViewState = { phase: 'reward', reward: { entries: [{ key: 'gold:1', kind: 'gold', amount: 12 }] } };
    const viewRuntime = {
      getFlowViewState: vi.fn(() => flowViewState),
      getViewState: vi.fn(() => nextViewState),
      releaseTransitionViewState,
    };

    const handled = await playBattleFlowStep({
      phaseUi,
      animQueue,
      viewRuntime,
    }, { kind: 'reward_open' });

    expect(handled).toBe(true);
    expect(phaseUi.playStep).toHaveBeenCalledWith(
      { kind: 'reward_open' },
      expect.objectContaining({
        animQueue,
        currentViewState: flowViewState,
        nextViewState,
        blocked: true,
      }),
    );
    expect(releaseTransitionViewState).toHaveBeenCalledTimes(1);
  });

  it('does not forward non-flow steps into the phase ui bridge', async () => {
    const phaseUi = { playStep: vi.fn(async () => true) };
    const handled = await playBattleFlowStep({
      phaseUi,
      animQueue: {},
      viewRuntime: {},
    }, { kind: 'attack' });

    expect(handled).toBe(false);
    expect(phaseUi.playStep).not.toHaveBeenCalled();
  });
});
