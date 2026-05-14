import { BATTLE_MODES } from '../state/battleModeState.js';
import { ProjectedViewRuntime } from '../../../src/runtime/core/ProjectedViewRuntime.js';

export class BattleViewRuntime {
  constructor({
    cloneState = (value) => value,
    applyRenderPatch = () => {},
    isFlowStep = () => false,
    getFallbackViewState = () => null,
    syncHud = () => {},
    syncStage = () => {},
    syncPiles = () => {},
    syncHand = () => {},
    syncBackdrop = () => {},
    syncPhaseUi = () => {},
    refreshInteractivity = () => {},
  } = {}) {
    this.cloneState = cloneState;
    this.getFallbackViewState = getFallbackViewState;
    this.lastBattleViewState = null;
    this.runtime = new ProjectedViewRuntime({
      cloneState,
      applyRenderPatch,
      shouldRetainPreviousViewState: (step, transaction) => isFlowStep(step, transaction),
      getFallbackViewState,
      renderProjection: (visibleState, context, { immediateHand = true } = {}) => {
        const battleViewState = this.resolveBattleProjectionState(visibleState, context);
        if (battleViewState) {
          syncHud(battleViewState);
          syncStage(battleViewState);
          syncPiles(battleViewState.piles);
          syncHand(battleViewState.hand, { immediate: immediateHand });
        }
        syncBackdrop(context.viewState ?? visibleState);
        syncPhaseUi(context.uiViewState);
        refreshInteractivity();
      },
    });
  }

  isBattleViewState(viewState) {
    return !!viewState && (viewState.phase ?? 'battle') === 'battle';
  }

  captureBattleViewState(viewState) {
    if (!this.isBattleViewState(viewState)) return null;
    this.lastBattleViewState = this.cloneState(viewState);
    return this.lastBattleViewState;
  }

  resolveBattleProjectionState(visibleState, context = {}) {
    const visibleBattleState = this.captureBattleViewState(visibleState);
    if (visibleBattleState) return visibleBattleState;

    for (const candidate of [
      context.transitionViewState,
      context.stageState,
      context.viewState,
      this.getFallbackViewState?.() ?? null,
    ]) {
      const battleState = this.captureBattleViewState(candidate);
      if (battleState) return battleState;
    }

    return this.lastBattleViewState ? this.cloneState(this.lastBattleViewState) : null;
  }

  reset() {
    this.lastBattleViewState = null;
    this.runtime.reset();
  }

  getViewState() {
    return this.runtime.getViewState();
  }

  getFlowViewState() {
    return this.runtime.getTransitionViewState();
  }

  getStageState() {
    return this.runtime.getStageState();
  }

  getPhaseUiState() {
    return this.runtime.getUiViewState();
  }

  releaseTransitionViewState() {
    return this.runtime.releaseTransitionViewState();
  }

  getCurrentTurn(fallback = this.getFallbackViewState?.()?.turn ?? 1) {
    return this.getViewState()?.turn ?? this.getStageState()?.turn ?? fallback;
  }

  getSteadyMode() {
    const viewState = this.getViewState() ?? this.getFallbackViewState?.() ?? null;
    if (!viewState) return BATTLE_MODES.loading;
    if ((viewState.phase ?? 'battle') !== 'battle') return BATTLE_MODES.flow;
    if (viewState.over) return BATTLE_MODES.battleOver;
    return BATTLE_MODES.idle;
  }

  setInitialState(initialState, { immediateHand = true } = {}) {
    this.runtime.setInitialState(initialState, { immediateHand });
  }

  resyncCurrent({ immediateHand = false, fallbackState = this.getFallbackViewState?.() ?? null } = {}) {
    return this.runtime.resyncCurrent({ immediateHand, fallbackState });
  }

  beginTransaction(transaction) {
    this.runtime.beginTransaction(transaction, { immediateHand: false });
  }

  applyStepPatch(step, { immediateHand = true } = {}) {
    this.runtime.applyStepPatch(step, { immediateHand });
  }

  commitTransaction({ immediateHand = false } = {}) {
    this.runtime.commitTransaction({ immediateHand });
  }
}

