import {
  clearBattleCheckpoints as defaultClearBattleCheckpoints,
  loadTurnStartCheckpoint as defaultLoadTurnStartCheckpoint,
  saveTurnStartCheckpoint as defaultSaveTurnStartCheckpoint,
} from '../support/battleCheckpointStore.js';
import { BATTLE_MODES } from '../state/battleModeState.js';

export class BattleCheckpointBridge {
  constructor({
    getSession = () => null,
    getBattleId = () => null,
    getCurrentTurn = () => 1,
    getIsPaused = () => false,
    restartFreshBattle = () => {},
    restartFromSnapshot = () => {},
    showToast = () => {},
    toastColor = null,
    clearBattleCheckpoints = defaultClearBattleCheckpoints,
    loadTurnStartCheckpoint = defaultLoadTurnStartCheckpoint,
    saveTurnStartCheckpoint = defaultSaveTurnStartCheckpoint,
  } = {}) {
    this.getSession = getSession;
    this.getBattleId = getBattleId;
    this.getCurrentTurn = getCurrentTurn;
    this.getIsPaused = getIsPaused;
    this.restartFreshBattle = restartFreshBattle;
    this.restartFromSnapshot = restartFromSnapshot;
    this.showToast = showToast;
    this.toastColor = toastColor;
    this.clearBattleCheckpoints = clearBattleCheckpoints;
    this.loadTurnStartCheckpoint = loadTurnStartCheckpoint;
    this.saveTurnStartCheckpoint = saveTurnStartCheckpoint;
  }

  clearCheckpoints() {
    const battleId = this.getBattleId?.();
    if (!battleId) return false;
    this.clearBattleCheckpoints?.(battleId);
    return true;
  }

  abandonBattle() {
    this.clearCheckpoints();
    this.restartFreshBattle?.();
    return true;
  }

  persistTurnStartCheckpoint(turn = this.getCurrentTurn?.()) {
    const session = this.getSession?.();
    const battleId = this.getBattleId?.();
    if (!session || !battleId || !Number.isFinite(turn)) return false;

    return !!this.saveTurnStartCheckpoint?.({
      battleId,
      turn,
      snapshot: session.getTurnCheckpoint?.(),
    });
  }

  restoreTurn() {
    const session = this.getSession?.();
    if (!session || !this.getIsPaused?.()) return false;

    const turn = this.getCurrentTurn?.(session.getViewState?.()?.turn ?? 1) ?? 1;
    const battleId = this.getBattleId?.();
    const turnCheckpoint = this.loadTurnStartCheckpoint?.({ battleId, turn }) ?? null;
    if (!turnCheckpoint) {
      this.showToast?.('未找到本回合起点。', this.toastColor);
      return false;
    }

    const phaseCheckpoint = session.getPhaseCheckpoint?.();
    const restartPhaseCheckpoint = phaseCheckpoint?.phase === turnCheckpoint?.phase
      ? phaseCheckpoint
      : turnCheckpoint;

    this.restartFromSnapshot?.({
      snapshot: turnCheckpoint,
      phaseCheckpoint: restartPhaseCheckpoint,
      turnCheckpoint,
      mode: turnCheckpoint?.battle?.over ? BATTLE_MODES.battleOver : BATTLE_MODES.idle,
    });
    return true;
  }
}
