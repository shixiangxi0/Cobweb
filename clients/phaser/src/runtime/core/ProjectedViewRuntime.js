// Generic render-side runtime for discrete-rule games.
// Logic owns the committed `viewState`; render owns only temporary
// `stageState` and optional `transitionViewState` while a transaction plays.
export class ProjectedViewRuntime {
  constructor({
    cloneState = (value) => value,
    applyRenderPatch = () => {},
    shouldRetainPreviousViewState = () => false,
    getFallbackViewState = () => null,
    renderProjection = () => {},
    selectUiViewState = ({ transitionViewState, viewState }) => transitionViewState ?? viewState,
  } = {}) {
    this.cloneState = cloneState;
    this.applyRenderPatch = applyRenderPatch;
    this.shouldRetainPreviousViewState = shouldRetainPreviousViewState;
    this.getFallbackViewState = getFallbackViewState;
    this.renderProjection = renderProjection;
    this.selectUiViewState = selectUiViewState;

    this.viewState = null;
    this.transitionViewState = null;
    this.stageState = null;
  }

  reset() {
    this.viewState = null;
    this.transitionViewState = null;
    this.stageState = null;
  }

  getViewState() {
    return this.viewState;
  }

  getTransitionViewState() {
    return this.transitionViewState;
  }

  getStageState() {
    return this.stageState;
  }

  getUiViewState() {
    return this.selectUiViewState({
      viewState: this.viewState,
      transitionViewState: this.transitionViewState,
      stageState: this.stageState,
      fallbackViewState: this.getFallbackViewState?.() ?? null,
    });
  }

  releaseTransitionViewState() {
    if (!this.transitionViewState) return false;
    this.transitionViewState = null;
    return true;
  }

  setInitialState(initialState, options = {}) {
    this.viewState = this.cloneState(initialState);
    this.rebuildStageState(this.viewState, options);
  }

  renderState(visibleState, options = {}) {
    if (!visibleState) return;
    this.renderProjection(visibleState, {
      viewState: this.viewState ?? visibleState,
      transitionViewState: this.transitionViewState,
      uiViewState: this.getUiViewState(),
      stageState: this.stageState,
    }, options);
  }

  rebuildStageState(viewState = this.viewState, options = {}) {
    if (!viewState) return;
    this.stageState = this.cloneState(viewState);
    this.renderState(this.stageState, options);
  }

  resyncCurrent({ fallbackState = this.getFallbackViewState?.() ?? null, ...options } = {}) {
    const source = this.stageState ?? this.viewState ?? fallbackState;
    if (!source) return false;
    this.renderState(source, options);
    return true;
  }

  beginTransaction(transaction, options = {}) {
    const steps = transaction?.resolution?.steps ?? [];
    const previousViewState = this.viewState ? this.cloneState(this.viewState) : null;

    this.viewState = this.cloneState(transaction?.afterState ?? this.getFallbackViewState?.() ?? null);
    this.transitionViewState = steps.some((step) => this.shouldRetainPreviousViewState(step, transaction))
      ? this.cloneState(previousViewState ?? this.viewState)
      : null;

    if (steps.length === 0 && this.viewState) {
      this.rebuildStageState(this.viewState, options);
    }
  }

  applyStepPatch(step, options = {}) {
    if (!this.stageState || !step) return;
    this.applyRenderPatch(this.stageState, step, this.viewState);
    this.renderState(this.stageState, options);
  }

  commitTransaction(options = {}) {
    this.transitionViewState = null;
    if (this.viewState) {
      this.rebuildStageState(this.viewState, options);
    }
  }
}
