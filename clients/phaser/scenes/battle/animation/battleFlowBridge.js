import { isFlowStep } from '../../shared/flow/FlowScreen.js';

export function isBattleFlowStep(step) {
  return isFlowStep(step);
}

export function playBattleFlowStep({
  phaseUi = null,
  animQueue = null,
  viewRuntime = null,
} = {}, step = null) {
  if (!isBattleFlowStep(step) || !phaseUi?.playStep || !animQueue) {
    return Promise.resolve(false);
  }

  const currentViewState = viewRuntime?.getFlowViewState?.()
    ?? viewRuntime?.getViewState?.()
    ?? null;
  const nextViewState = viewRuntime?.getViewState?.() ?? currentViewState;

  return phaseUi.playStep(step, {
    animQueue,
    currentViewState,
    nextViewState,
    blocked: true,
    releaseRetainedViewState: () => viewRuntime?.releaseTransitionViewState?.(),
  });
}
