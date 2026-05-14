import { AnimationQueue } from './animation/animationQueue.js';
import { BattleAnimator } from './animation/battleAnimator.js';
import { preloadBattleDragonBones } from './animation/battleDragonBones.js';
import {
  createBattleEnvironment,
  preloadBattleEnvironment,
  relayoutBattleEnvironment,
} from './view/battleEnvironment.js';
import { BattleHandController } from './view/battleHand.js';
import {
  refreshEndTurnButton,
  syncBattleHud,
  syncBattlePiles,
} from './view/battleHud.js';
import { BattleInputController } from './input/battleInput.js';
import { computeBattleLayout } from './state/battleLayout.js';
import { BattleStageController } from './view/battleStage.js';
import { applyBattleRenderPatch, cloneBattleState } from './state/battleState.js';
import { BATTLE_MODES, isBlockedBattleMode } from './state/battleModeState.js';
import {
  applyModeToHud,
  refreshCardVisualState,
} from './state/battleUiState.js';
import { BattlePauseMenu } from './view/battlePauseMenu.js';
import { buildBattleClips } from './animation/battlePresentation.js';
import { isBattleFlowStep, playBattleFlowStep } from './animation/battleFlowBridge.js';
import {
  createBattleId,
} from './support/battleCheckpointStore.js';
import { BaseScene } from '../../src/phaserCompat.js';
import { BattleCheckpointBridge } from './runtime/BattleCheckpointBridge.js';
import { BattleSessionActionBridge } from './runtime/BattleSessionActionBridge.js';
import { getLocale } from '../../../shared/locale.js';
import { BattleViewRuntime } from './runtime/BattleViewRuntime.js';
import { RenderTransactionRunner } from '../../src/runtime/core/RenderTransactionRunner.js';
import { SessionActionDriver } from '../../src/runtime/core/SessionActionDriver.js';
import { PhaseUiController } from '../shared/flow/PhaseUiController.js';
import { createCobwebSessionHost } from '../shared/CobwebSessionHost.js';
import { COBWEB_SCENE_KEYS, sceneKeyForViewState } from '../shared/cobwebSceneKeys.js';
import {
  COLORS,
  DEMO_SCENARIO,
} from '../../src/constants.js';

export class BattleScene extends BaseScene {
  constructor() {
    super('CobwebBattleScene');

    this.bootstrap = null;
    this.host = null;
    this.battleId = null;
    this.scenario = DEMO_SCENARIO;
    this.resizeQueued = false;
    this.mode = BATTLE_MODES.loading;
    this.session = null;
    this.viewRuntime = null;
    this.content = { cards: {}, relics: {}, statuses: {}, enemies: {} };

    this.ui = {};
    this.flowController = null;
    this.animator = null;
    this.handController = null;
    this.inputController = null;
    this.stageController = null;
    this.renderRunner = null;
    this.actionDriver = null;
    this.sessionActions = null;
    this.checkpointBridge = null;

    this.paused = false;
    this.pauseMenu = null;
    this._unbindSceneGlobalInput = null;
  }

  _getInteractionMode() {
    return this.paused ? BATTLE_MODES.paused : this.mode;
  }

  preload() {
    preloadBattleEnvironment(this);
    preloadBattleDragonBones(this);
  }

  init(data = {}) {
    this.bootstrap = data;
    this.host = data.host ?? createCobwebSessionHost({
      scenario: data.scenario ?? DEMO_SCENARIO,
      battleId: data.battleId ?? createBattleId(),
      snapshot: data.snapshot ?? null,
      phaseCheckpoint: data.phaseCheckpoint ?? null,
      turnCheckpoint: data.turnCheckpoint ?? null,
      mode: data.mode ?? null,
    });
    this.battleId = this.host.getBattleId?.() ?? data.battleId ?? createBattleId();
    this.scenario = this.host.getScenario?.() ?? data.scenario ?? DEMO_SCENARIO;
    this.resizeQueued = false;
    this.mode = BATTLE_MODES.loading;
    this.session = null;
    this.viewRuntime = null;
    this.content = { cards: {}, relics: {}, statuses: {}, enemies: {} };
    this.ui = {};
    this.flowController = null;
    this.animator = null;
    this.handController = null;
    this.inputController = null;
    this.stageController = null;
    this.renderRunner = null;
    this.actionDriver = null;
    this.sessionActions = null;
    this.checkpointBridge = null;
    this.paused = false;
    this.pauseMenu = null;

  }

  async create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    let initialState = null;

    try {
      initialState = await this.host.getReadyViewState();
      this.session = this.host.getSession?.() ?? null;
      this.content = this.host.getContent?.() ?? this.content;
    } catch (error) {
      this._showFatal(`初始化失败: ${error?.message ?? String(error)}`);
      return;
    }

    if ((initialState?.phase ?? 'battle') !== 'battle') {
      this.scene.start(sceneKeyForViewState(initialState), this.host.buildSceneData());
      return;
    }

    this.layout = computeBattleLayout(this.W, this.H);
    this._initStageController();
    this.ui = createBattleEnvironment(this, {
      createPlayerNode: (options) => this.stageController?.createPlayerNode(options),
      onEndTurnPressed: () => this._onEndTurnPressed(),
      onPausePressed: () => this._enterPause(),
      getMode: () => this._getInteractionMode(),
      scenarioName: this.scenario?.name ?? null,
    });
    this._initHandController();
    this._initInputController();
    this._bindGlobalInput();
    this._initPhaseUi();
    this._initViewRuntime();
    this._initQueue();
    this._initSessionBridges();
    this._initPauseMenu();
    this.viewRuntime?.setInitialState(initialState, { immediateHand: true });
    this.checkpointBridge?.persistTurnStartCheckpoint();

    if (this.bootstrap?.snapshot) {
      this._setMode(this.host.getBootstrapMode(this.viewRuntime?.getSteadyMode() ?? BATTLE_MODES.loading));
      return;
    }

    const introSteps = (this.session.initialResolution?.steps ?? []).filter(
      (step) => step.kind === 'battle_start' || step.kind === 'turn_start',
    );

    if (introSteps.length > 0) {
      this.renderRunner?.begin({ steps: introSteps }, {
        afterState: this.viewRuntime?.getViewState() ?? null,
      });
    } else {
      this._setMode(this.viewRuntime?.getSteadyMode() ?? BATTLE_MODES.loading);
    }
  }

  _initHandController() {
    this.handController = new BattleHandController(this, {
      getMode: () => this._getInteractionMode(),
      getDraggedNode: () => this.inputController?.drag?.node ?? null,
      getTargetingCardId: () => this.inputController?.targetingCardId ?? null,
      onCardPointerDown: (node, pointer) => this.inputController?.onCardPointerDown(node, pointer),
    });
  }

  _initStageController() {
    this.stageController = new BattleStageController(this, {
      getMode: () => this._getInteractionMode(),
      getDrag: () => this.inputController?.drag ?? null,
      getTargetingCardId: () => this.inputController?.targetingCardId ?? null,
      onEnemySelected: (enemyId, instanceId) => this._attemptPlay(instanceId, enemyId),
    });
  }

  _initInputController() {
    this.inputController = new BattleInputController(this, {
      getMode: () => this._getInteractionMode(),
      setMode: (mode) => this._setMode(mode),
      isPlayable: (card) => this._isPlayable(card),
      showToast: (text, color) => this._showToast(text, color),
      attemptPlay: (instanceId, target) => this._attemptPlay(instanceId, target),
      resolveActorAnchor: (actorId) => this.stageController?.resolveAnchor(actorId),
      actorName: (actorId) => this.stageController?.actorName(actorId, this.viewRuntime?.getStageState()),
      refreshEnemyHighlights: () => this._refreshEnemyHighlights(),
      getHandNode: (instanceId) => this.handController?.getNode(instanceId) ?? null,
      getHandOrder: () => this.handController?.getOrder() ?? [],
      setHandNodeState: (node, state, config) => this.handController?.setNodeState(node, state, config),
      returnHandNode: (node) => this.handController?.returnNode(node),
      getEnemyNodes: () => this.stageController?.getEnemyNodes() ?? new Map().entries(),
      getEnemyCount: () => this.stageController?.getEnemyCount() ?? 0,
    });
  }

  _initViewRuntime() {
    this.viewRuntime = new BattleViewRuntime({
      cloneState: (value) => cloneBattleState(value),
      applyRenderPatch: (stageState, step, viewState) => applyBattleRenderPatch(stageState, step, viewState),
      isFlowStep: (step) => isBattleFlowStep(step),
      getFallbackViewState: () => this.host?.getViewState?.() ?? null,
      syncHud: (viewState) => syncBattleHud(this.ui, viewState),
      syncStage: (viewState) => this.stageController?.sync(viewState, this.content.statuses),
      syncPiles: (piles) => syncBattlePiles(this.ui, piles),
      syncHand: (hand, options) => this.handController?.sync(hand, options),
      syncBackdrop: (viewState) => this._syncSceneBackdrop(viewState),
      syncPhaseUi: (viewState) => this._syncPhaseUi(viewState),
      refreshInteractivity: () => this._refreshInteractivity(),
    });
  }

  _initPauseMenu() {
    this.pauseMenu = new BattlePauseMenu(this, {
      onResume: () => this._exitPause(),
      onRestoreTurn: () => this.checkpointBridge?.restoreTurn(),
      onAbandon: () => this.checkpointBridge?.abandonBattle(),
    });
  }

  _initPhaseUi() {
    this.flowController = new PhaseUiController(this, {
      onRestart: () => {
        this.checkpointBridge?.clearCheckpoints();
        this._restartFreshBattle();
      },
    });
  }

  _enterPause() {
    if (this.paused || this.mode === BATTLE_MODES.loading || this.mode === BATTLE_MODES.battleOver) return;

    this.inputController?.cancelForPause?.();
    this.paused = true;
    this.animQueue?.setPaused(true);
    this.tweens.pauseAll();
    this.pauseMenu?.show();
    this._refreshInteractivity();
  }

  _exitPause() {
    if (!this.paused) return;
    this.paused = false;
    this.pauseMenu?.hide();
    this.tweens.resumeAll();
    this.animQueue?.setPaused(false);
    this._refreshInteractivity();
  }

  _bindGlobalInput() {
    this._unbindSceneGlobalInput?.();
    this.inputController.bindGlobalInput();

    const esc = this.input.keyboard?.addKey('ESC');
    const onEscDown = () => {
      if (this.paused) this._exitPause();
      else this._enterPause();
    };
    if (esc) {
      esc.on('down', onEscDown);
    }

    const handleResize = (gameSize) => {
      const nextWidth = Math.round(gameSize?.width ?? this.scale.width);
      const nextHeight = Math.round(gameSize?.height ?? this.scale.height);
      if (!nextWidth || !nextHeight) return;
      if (nextWidth === this.W && nextHeight === this.H) return;
      if (this.resizeQueued) return;

      this.resizeQueued = true;
      this.time.delayedCall(0, () => {
        this.resizeQueued = false;
        this._relayoutScene(
          Math.round(this.scale.width),
          Math.round(this.scale.height),
        );
      });
    };

    this.scale.on('resize', handleResize);
    const cleanup = () => {
      this.inputController?.unbindGlobalInput?.();
      if (esc) esc.off('down', onEscDown);
      this.scale.off('resize', handleResize);
      this._unbindSceneGlobalInput = null;
    };

    this._unbindSceneGlobalInput = cleanup;
    this.events.once('shutdown', cleanup);
  }

  _initQueue() {
    this.animQueue = new AnimationQueue(this, {
      onBusyChange: (busy) => {
        if (busy && this.mode !== BATTLE_MODES.battleOver) this._setMode(BATTLE_MODES.animating);
      },
      onDrained: () => this._onQueueDrained(),
    });
    this.animator = new BattleAnimator(this, {
      animQueue: this.animQueue,
      ui: this.ui,
      layout: this.layout,
      getHandNode: (instanceId) => this.handController?.getNode(instanceId) ?? null,
      getHandNodes: () => this.handController?.getNodes() ?? new Map(),
      beginResolvingCard: (instanceId) => this.handController?.beginResolving(instanceId) ?? null,
      beginZoneTransition: (instanceId, state) => this.handController?.beginZoneTransition(instanceId, state) ?? null,
      removeHandNode: (instanceId) => this.handController?.remove(instanceId) ?? null,
      applyRenderPatch: (step, options) => this._applyRenderPatch(step, options),
      resolveActorNode: (actorId) => this.stageController?.resolveNode(actorId),
      resolveActorAnchor: (actorId) => this.stageController?.resolveAnchor(actorId),
      beginActorMotion: (actorId, motionState) => this.stageController?.beginMotion(actorId, motionState) ?? null,
      endActorMotion: (actorId, options) => this.stageController?.endMotion(actorId, options) ?? null,
      actorName: (actorId) => this.stageController?.actorName(actorId, this.viewRuntime?.getStageState()),
      statusLabel: (statusId) => this.content.statuses?.[statusId]?.name ?? statusId ?? 'Status',
      playFlowStep: (step) => playBattleFlowStep({
        phaseUi: this.flowController,
        animQueue: this.animQueue,
        viewRuntime: this.viewRuntime,
      }, step),
    });
    this.renderRunner = new RenderTransactionRunner({
      buildClips: (steps) => buildBattleClips(steps),
      enqueueTasks: (tasks) => this.animQueue.enqueueMany(tasks),
      playClip: (clip) => this.animator.playClip(clip),
      onTransactionStart: (transaction) => this._onRenderTransactionStarted(transaction),
      onTransactionCommit: (transaction) => this._onRenderTransactionCommitted(transaction),
    });
    this.actionDriver = new SessionActionDriver({
      hasPendingRenderTransaction: () => this.renderRunner?.hasPending() ?? false,
      beginRenderTransaction: (resolution, options) => this.renderRunner?.begin(resolution, options),
      getFallbackState: () => this.viewRuntime?.getViewState() ?? this.host?.getViewState?.() ?? null,
      resolveFailureText: (result, failureMessages, defaultFailureText) => this._resolveFailureText(
        result,
        failureMessages,
        defaultFailureText,
      ),
      showFailureText: (text) => {
        if (text) this._showToast(text, COLORS.textSoft);
      },
    });
  }

  _initSessionBridges() {
    const lang = this.host?.getScenario?.()?.lang ?? 'zh';
    this.sessionActions = new BattleSessionActionBridge({
      getSession: () => this.host?.getSession?.() ?? null,
      actionDriver: this.actionDriver,
      locale: getLocale(lang),
      onPlayFailure: () => {
        this.inputController.clearAfterAction();
        this._setMode(BATTLE_MODES.idle);
      },
      onBeforePlayApply: (instanceId) => {
        this.inputController.clearAfterAction({ skipReturnInstanceId: instanceId });
      },
      onTurnCommitted: (turn) => {
        this.checkpointBridge?.persistTurnStartCheckpoint(turn);
      },
      onDebugApplied: (result) => {
        console.info('[battleDebug] command applied', {
          command: result.resolution?.command?.type ?? 'debug_command',
          phase: result.state?.phase ?? 'battle',
          gold: result.state?.run?.gold ?? 0,
          relics: result.state?.run?.relics ?? [],
        });
      },
    });
    this.checkpointBridge = new BattleCheckpointBridge({
      getSession: () => this.host?.getSession?.() ?? null,
      getBattleId: () => this.battleId,
      getCurrentTurn: (fallbackTurn = this.host?.getViewState?.()?.turn ?? 1) => (
        this.viewRuntime?.getCurrentTurn(fallbackTurn) ?? fallbackTurn
      ),
      getIsPaused: () => this.paused,
      restartFreshBattle: () => this._restartFreshBattle(),
      restartFromSnapshot: (options) => this._restartFromSnapshot(options),
      showToast: (text, color) => this._showToast(text, color),
      toastColor: COLORS.textSoft,
    });
  }

  _relayoutScene(nextWidth = Math.round(this.scale.width), nextHeight = Math.round(this.scale.height)) {
    if (!nextWidth || !nextHeight) return;

    this.W = nextWidth;
    this.H = nextHeight;
    this.layout = computeBattleLayout(this.W, this.H);
    if (this.animator) {
      this.animator.layout = this.layout;
    }

    relayoutBattleEnvironment(this, this.ui);
    this.pauseMenu?.relayout?.();
    this._syncSceneBackdrop(this.viewRuntime?.getViewState() ?? null);
    this._syncPhaseUi();

    if (!this.animQueue?.running) {
      const synced = this.viewRuntime?.resyncCurrent({
        immediateHand: false,
        fallbackState: this.host?.getViewState?.() ?? null,
      }) ?? false;
      if (!synced) {
        this._refreshInteractivity();
      }
    } else {
      this._refreshInteractivity();
    }

    this.inputController?.refreshLayout?.();
  }

  _resolveFailureText(result, failureMessages = {}, defaultFailureText = '这一项暂时无法处理。') {
    return failureMessages?.[result?.reason] ?? defaultFailureText;
  }

  _setMode(mode) {
    this.mode = mode;
    applyModeToHud(this.ui, this._getInteractionMode());
    this._refreshInteractivity();
  }

  _refreshInteractivity() {
    const currentMode = this._getInteractionMode();
    refreshEndTurnButton(this.ui, currentMode);
    this._refreshCards();
    this._refreshEnemyHighlights();

    if (currentMode !== BATTLE_MODES.targeting && !this.inputController.drag) {
      this.ui.targetHint.setVisible(false);
      this.ui.targetLine.clear();
      this.ui.playZone?.container?.setVisible(false);
      this.ui.handZone?.container?.setVisible(false);
    }

    this._syncPhaseUi();
  }

  _refreshCards() {
    refreshCardVisualState({
      handNodes: this.handController?.getNodes() ?? new Map(),
      targetingCardId: this.inputController.targetingCardId,
      energy: this.viewRuntime?.getStageState()?.player?.energy ?? 0,
      mode: this._getInteractionMode(),
      isPlayable: (card, energy) => this._isPlayable(card, energy),
    });
  }

  _refreshEnemyHighlights() {
    this.stageController?.refreshTargetHighlights();
  }

  _isPlayable(card, energy = this.viewRuntime?.getStageState()?.player?.energy ?? 0) {
    if (!card) return false;
    const mode = this._getInteractionMode();
    if (isBlockedBattleMode(mode)) return false;
    return card.cost < 0 || card.cost <= energy;
  }

  _attemptPlay(instanceId, target) {
    this.sessionActions?.play(instanceId, target);
  }

  _onEndTurnPressed() {
    if (this.paused || this.mode !== BATTLE_MODES.idle) return;
    this.sessionActions?.endTurn();
  }

  _syncSceneBackdrop(viewState = this.viewRuntime?.getViewState() ?? null) {
    if (!this.ui?.overlayBg || !this.ui?.overlayText) return;
    const shouldDim = !!viewState && !!viewState.over;
    this.ui.overlayBg.setAlpha(shouldDim ? 0.18 : 0);
    if (!shouldDim) {
      this.ui.overlayText.setAlpha(0).setText('');
      return;
    }
    this.ui.overlayText.setAlpha(0).setText('');
  }

  _syncPhaseUi(viewState = this.viewRuntime?.getPhaseUiState() ?? null) {
    const phaseUiState = (viewState?.phase ?? 'battle') === 'battle' && viewState?.over
      ? viewState
      : null;
    this.flowController?.sync(phaseUiState, {
      blocked: this.paused || this.mode === BATTLE_MODES.loading || this.mode === BATTLE_MODES.animating,
    });
  }

  _restartFreshBattle() {
    const sceneKey = COBWEB_SCENE_KEYS.battle;
    if (this.paused) {
      this._exitPause();
    }
    const host = createCobwebSessionHost({
      scenario: this.scenario,
    });
    this.scene.start(sceneKey, host.buildSceneData());
  }

  _restartFromSnapshot({
    snapshot,
    mode = BATTLE_MODES.idle,
    phaseCheckpoint = null,
    turnCheckpoint = null,
  } = {}) {
    if (!snapshot) return;
    const sceneKey = COBWEB_SCENE_KEYS.battle;
    if (this.paused) {
      this._exitPause();
    }
    const host = createCobwebSessionHost({
      battleId: this.battleId,
      scenario: this.scenario,
      snapshot,
      phaseCheckpoint,
      turnCheckpoint,
      mode,
    });
    this.scene.start(sceneKey, host.buildSceneData());
  }

  _onRenderTransactionStarted(transaction) {
    this.viewRuntime?.beginTransaction(transaction);
    const steps = transaction?.resolution?.steps ?? [];
    if (steps.length === 0) return;
    this._setMode(BATTLE_MODES.animating);
  }

  _onRenderTransactionCommitted(transaction) {
    let committedState = transaction.afterState ?? this.viewRuntime?.getViewState() ?? null;
    const pending = this.host?.getPendingTransaction?.() ?? null;
    if (pending && pending.txId === transaction?.id) {
      const ack = this.host?.ackRender?.(transaction.id);
      if (ack?.success) {
        committedState = ack.state ?? committedState;
      } else {
        console.error('[BattleScene] render ack failed:', ack?.reason ?? 'unknown');
      }
    }

    try {
      transaction?.onCommitted?.(committedState, transaction);
    } catch (error) {
      console.error('[BattleScene] render transaction commit failed:', error);
    }

    if ((committedState?.phase ?? 'battle') !== 'battle') {
      this.scene.start(sceneKeyForViewState(committedState), this.host.buildSceneData());
      return;
    }

    this._setMode(this.viewRuntime?.getSteadyMode() ?? BATTLE_MODES.loading);
  }

  _applyRenderPatch(step, { immediateHand = true } = {}) {
    this.viewRuntime?.applyStepPatch(step, { immediateHand });
  }

  _onQueueDrained() {
    this.animator?.clearActiveCards?.();
    this.handController?.clearTransientNodes?.();
    this.viewRuntime?.commitTransaction({ immediateHand: false });
    this.renderRunner?.complete();
  }

  _showToast(text, color = COLORS.textMain) {
    this.ui.toast.setText(text).setColor(color).setAlpha(1);
    this.ui.toast.setY(this.layout.hand.y - this.layout.hand.h / 2 - 30);
    this.tweens.killTweensOf(this.ui.toast);
    this.tweens.add({
      targets: this.ui.toast,
      y: this.ui.toast.y - 14,
      alpha: 0,
      duration: 860,
      ease: 'Cubic.Out',
    });
  }

  _showFatal(message) {
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x050607, 0.86).setDepth(998);
    this.add.text(this.W / 2, this.H / 2, message, {
      fontSize: '28px',
      color: COLORS.accentCoral,
      align: 'center',
      wordWrap: { width: this.W - 180 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(999);
  }
}





