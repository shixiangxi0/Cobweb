import { BaseScene } from '../../src/phaserCompat.js';
import { COLORS } from '../../src/constants.js';
import { AnimationQueue } from '../battle/animation/animationQueue.js';
import { PhaseUiController } from './flow/PhaseUiController.js';
import { RenderTransactionRunner } from '../../src/runtime/core/RenderTransactionRunner.js';
import { SessionActionDriver } from '../../src/runtime/core/SessionActionDriver.js';
import { createCobwebSessionHost } from './CobwebSessionHost.js';
import { sceneKeyForViewState } from './cobwebSceneKeys.js';

function buildFlowClips(steps = [], acceptStep = () => true) {
  return steps
    .filter((step) => acceptStep(step))
    .map((step) => ({ kind: 'single', step }));
}

function defaultFailureText(result, failureMessages = {}, fallbackText = '这一项暂时无法处理。') {
  return failureMessages?.[result?.reason] ?? fallbackText;
}

export class FlowPhaseScene extends BaseScene {
  constructor(sceneKey, phaseName) {
    super(sceneKey);

    this.phaseName = phaseName;
    this.host = null;
    this.currentViewState = null;
    this.pendingViewState = null;
    this.busy = false;
    this.phaseUi = null;
    this.animQueue = null;
    this.renderRunner = null;
    this.actionDriver = null;
    this.toast = null;
    this.inputShield = null;
    this.resizeQueued = false;
    this._unbindResize = null;
  }

  init(data = {}) {
    this.host = data.host ?? createCobwebSessionHost({
      scenario: data.scenario,
      battleId: data.battleId,
      snapshot: data.snapshot,
      phaseCheckpoint: data.phaseCheckpoint,
      turnCheckpoint: data.turnCheckpoint,
      mode: data.mode,
    });
    this.currentViewState = null;
    this.pendingViewState = null;
    this.busy = false;
    this.phaseUi = null;
    this.animQueue = null;
    this.renderRunner = null;
    this.actionDriver = null;
    this.toast = null;
    this.inputShield = null;
    this.resizeQueued = false;
    this._unbindResize = null;
  }

  async create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this._createToast();
    this._createInputShield();
    this._initPhaseUi();
    this._initRuntime();
    this._bindResize();

    const viewState = await this.host.getReadyViewState();
    this.currentViewState = viewState;
    if (!this._matchesExpectedPhase(viewState)) {
      this._routeToViewState(viewState);
      return;
    }

    this._syncPhaseUi(viewState);
  }

  _matchesExpectedPhase(viewState = this.currentViewState) {
    return (viewState?.phase ?? 'battle') === this.phaseName;
  }

  _createToast() {
    this.toast = this.add.text(0, 0, '', {
      fontFamily: '"Trebuchet MS", "Verdana", sans-serif',
      fontSize: '18px',
      color: COLORS.textMain,
      backgroundColor: '#f8f2e8',
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
      stroke: '#181412',
      strokeThickness: 1,
    })
      .setOrigin(0.5)
      .setDepth(420)
      .setVisible(false);
    this._layoutToast();
  }

  _layoutToast() {
    if (!this.toast) return;
    this.toast.setPosition(this.W / 2, this.H - 72);
  }

  _createInputShield() {
    this.inputShield = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.001)
      .setDepth(400)
      .setVisible(false)
      .setInteractive();
    this.inputShield.disableInteractive();
    this.inputShield.on('pointerdown', (_pointer, _localX, _localY, event) => {
      event?.stopPropagation?.();
    });
  }

  _layoutInputShield() {
    if (!this.inputShield) return;
    this.inputShield.setPosition(this.W / 2, this.H / 2);
    this.inputShield.setSize(this.W, this.H);
  }

  _setBusy(busy) {
    this.busy = !!busy;
    if (!this.inputShield) return;
    this.inputShield.setVisible(this.busy);
    if (this.busy) this.inputShield.setInteractive();
    else this.inputShield.disableInteractive();
  }

  _initPhaseUi() {
    this.phaseUi = new PhaseUiController(this, this._createPhaseCallbacks());
  }

  _createPhaseCallbacks() {
    return {};
  }

  _acceptFlowStep(step) {
    return false;
  }

  _initRuntime() {
    this.animQueue = new AnimationQueue(this, {
      onBusyChange: (busy) => this._setBusy(busy),
      onDrained: () => this._onQueueDrained(),
    });
    this.renderRunner = new RenderTransactionRunner({
      buildClips: (steps) => buildFlowClips(steps, (step) => this._acceptFlowStep(step)),
      enqueueTasks: (tasks) => this.animQueue.enqueueMany(tasks),
      playClip: (clip) => this._playClip(clip),
      onTransactionStart: (transaction) => this._onRenderTransactionStarted(transaction),
      onTransactionCommit: (transaction) => this._onRenderTransactionCommitted(transaction),
    });
    this.actionDriver = new SessionActionDriver({
      hasPendingRenderTransaction: () => this.renderRunner?.hasPending() ?? false,
      beginRenderTransaction: (resolution, options) => this.renderRunner?.begin(resolution, options),
      getFallbackState: () => this.currentViewState ?? this.host?.getViewState?.() ?? null,
      resolveFailureText: (result, failureMessages, fallbackText) => defaultFailureText(
        result,
        failureMessages,
        fallbackText,
      ),
      showFailureText: (text) => this._showToast(text),
    });
  }

  _playClip(clip) {
    return this.phaseUi?.playStep?.(clip?.step, {
      animQueue: this.animQueue,
      currentViewState: this.currentViewState,
      nextViewState: this.pendingViewState ?? this.currentViewState,
      blocked: false,
    }) ?? Promise.resolve(false);
  }

  _onRenderTransactionStarted(transaction) {
    this.pendingViewState = transaction?.afterState ?? this.host?.getViewState?.() ?? null;
  }

  _onRenderTransactionCommitted(transaction) {
    let committedState = transaction?.afterState ?? this.pendingViewState ?? this.host?.getViewState?.() ?? null;
    const pending = this.host?.getPendingTransaction?.() ?? null;
    if (pending && pending.txId === transaction?.id) {
      const ack = this.host?.ackRender?.(transaction.id);
      if (ack?.success) {
        committedState = ack.state ?? committedState;
      } else {
        console.error('[FlowPhaseScene] render ack failed:', ack?.reason ?? 'unknown');
      }
    }

    try {
      transaction?.onCommitted?.(committedState, transaction);
    } catch (error) {
      console.error('[FlowPhaseScene] render transaction commit failed:', error);
    }

    this.pendingViewState = null;
    this.currentViewState = committedState ?? this.host?.getViewState?.() ?? null;

    if (!this._matchesExpectedPhase(this.currentViewState)) {
      this._routeToViewState(this.currentViewState);
      return;
    }

    this._syncPhaseUi(this.currentViewState);
  }

  _onQueueDrained() {
    this.renderRunner?.complete();
  }

  _syncPhaseUi(viewState = this.currentViewState) {
    this.phaseUi?.sync(viewState, { blocked: false });
  }

  _routeToViewState(viewState) {
    const targetSceneKey = sceneKeyForViewState(viewState);
    if (targetSceneKey === this.sys.settings.key) {
      this._syncPhaseUi(viewState);
      return;
    }
    this.scene.start(targetSceneKey, this.host.buildSceneData());
  }

  _showToast(text = '') {
    if (!text || !this.toast) return;
    this.toast.setText(text).setVisible(true).setAlpha(1);
    this._layoutToast();
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({
      targets: this.toast,
      y: this.toast.y - 16,
      alpha: 0,
      duration: 820,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.toast?.setVisible(false);
        this._layoutToast();
      },
    });
  }

  _bindResize() {
    const handleResize = (gameSize) => {
      const nextWidth = Math.round(gameSize?.width ?? this.scale.width);
      const nextHeight = Math.round(gameSize?.height ?? this.scale.height);
      if (!nextWidth || !nextHeight) return;
      if (nextWidth === this.W && nextHeight === this.H) return;
      if (this.resizeQueued) return;

      this.resizeQueued = true;
      this.time.delayedCall(0, () => {
        this.resizeQueued = false;
        this.W = Math.round(this.scale.width);
        this.H = Math.round(this.scale.height);
        this._layoutToast();
        this._layoutInputShield();
        this._syncPhaseUi(this.currentViewState);
      });
    };

    this.scale.on('resize', handleResize);
    this._unbindResize = () => {
      this.scale.off('resize', handleResize);
      this._unbindResize = null;
    };
    this.events.once('shutdown', () => {
      this._unbindResize?.();
    });
  }
}




