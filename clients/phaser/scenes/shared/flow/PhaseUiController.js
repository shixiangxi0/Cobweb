import {
  createFlowScreen,
  playFlowStep,
  syncFlowScreen,
} from './FlowScreen.js';

export class PhaseUiController {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.screen = createFlowScreen(scene, callbacks);
  }

  sync(viewState, options = {}) {
    syncFlowScreen(this.screen, viewState, options);
  }

  playStep(step, options = {}) {
    return playFlowStep(this.screen, step, options);
  }
}

