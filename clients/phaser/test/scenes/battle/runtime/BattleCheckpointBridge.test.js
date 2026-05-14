import { describe, expect, it, vi } from 'vitest';

import { BATTLE_MODES } from '../../../../scenes/battle/state/battleModeState.js';
import { BattleCheckpointBridge } from '../../../../scenes/battle/runtime/BattleCheckpointBridge.js';

describe('BattleCheckpointBridge', () => {
  it('persists the latest committed turn checkpoint through the checkpoint store', () => {
    const saveTurnStartCheckpoint = vi.fn(() => true);
    const session = {
      getTurnCheckpoint: vi.fn(() => ({ phase: 'battle', turn: 2 })),
    };
    const bridge = new BattleCheckpointBridge({
      getSession: () => session,
      getBattleId: () => 'battle_1',
      getCurrentTurn: () => 2,
      saveTurnStartCheckpoint,
    });

    expect(bridge.persistTurnStartCheckpoint()).toBe(true);
    expect(saveTurnStartCheckpoint).toHaveBeenCalledWith({
      battleId: 'battle_1',
      turn: 2,
      snapshot: { phase: 'battle', turn: 2 },
    });
  });

  it('shows a toast instead of restarting when no turn checkpoint is available', () => {
    const loadTurnStartCheckpoint = vi.fn(() => null);
    const restartFromSnapshot = vi.fn();
    const showToast = vi.fn();
    const session = {
      getViewState: vi.fn(() => ({ turn: 4 })),
    };
    const bridge = new BattleCheckpointBridge({
      getSession: () => session,
      getBattleId: () => 'battle_2',
      getCurrentTurn: () => 4,
      getIsPaused: () => true,
      loadTurnStartCheckpoint,
      restartFromSnapshot,
      showToast,
      toastColor: 0xaabbcc,
    });

    expect(bridge.restoreTurn()).toBe(false);
    expect(loadTurnStartCheckpoint).toHaveBeenCalledWith({ battleId: 'battle_2', turn: 4 });
    expect(showToast).toHaveBeenCalledWith('未找到本回合起点。', 0xaabbcc);
    expect(restartFromSnapshot).not.toHaveBeenCalled();
  });

  it('restores the saved turn checkpoint and keeps the phase checkpoint when phases match', () => {
    const turnCheckpoint = { phase: 'battle', battle: { over: false }, turn: 3 };
    const phaseCheckpoint = { phase: 'battle', marker: 'phase-start' };
    const restartFromSnapshot = vi.fn();
    const bridge = new BattleCheckpointBridge({
      getSession: () => ({
        getViewState: () => ({ turn: 3 }),
        getPhaseCheckpoint: () => phaseCheckpoint,
      }),
      getBattleId: () => 'battle_3',
      getCurrentTurn: () => 3,
      getIsPaused: () => true,
      loadTurnStartCheckpoint: () => turnCheckpoint,
      restartFromSnapshot,
    });

    expect(bridge.restoreTurn()).toBe(true);
    expect(restartFromSnapshot).toHaveBeenCalledWith({
      snapshot: turnCheckpoint,
      phaseCheckpoint,
      turnCheckpoint,
      mode: BATTLE_MODES.idle,
    });
  });

  it('falls back to the turn checkpoint as the phase checkpoint when the saved phase changed', () => {
    const turnCheckpoint = { phase: 'reward', battle: { over: true }, turn: 5 };
    const restartFromSnapshot = vi.fn();
    const bridge = new BattleCheckpointBridge({
      getSession: () => ({
        getViewState: () => ({ turn: 5 }),
        getPhaseCheckpoint: () => ({ phase: 'battle', marker: 'phase-start' }),
      }),
      getBattleId: () => 'battle_4',
      getCurrentTurn: () => 5,
      getIsPaused: () => true,
      loadTurnStartCheckpoint: () => turnCheckpoint,
      restartFromSnapshot,
    });

    bridge.restoreTurn();

    expect(restartFromSnapshot).toHaveBeenCalledWith({
      snapshot: turnCheckpoint,
      phaseCheckpoint: turnCheckpoint,
      turnCheckpoint,
      mode: BATTLE_MODES.battleOver,
    });
  });

  it('clears checkpoints before restarting a fresh battle', () => {
    const clearBattleCheckpoints = vi.fn();
    const restartFreshBattle = vi.fn();
    const bridge = new BattleCheckpointBridge({
      getBattleId: () => 'battle_5',
      clearBattleCheckpoints,
      restartFreshBattle,
    });

    expect(bridge.abandonBattle()).toBe(true);
    expect(clearBattleCheckpoints).toHaveBeenCalledWith('battle_5');
    expect(restartFreshBattle).toHaveBeenCalledTimes(1);
  });
});
