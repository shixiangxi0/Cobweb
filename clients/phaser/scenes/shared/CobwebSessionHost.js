import { createSession } from '../../../../games/sts/src/index.js';
import { DEMO_SCENARIO } from '../../src/constants.js';
import { createBattleId } from '../battle/support/battleCheckpointStore.js';
import { buildRenderResolution } from '../../../shared/renderStepInterpreter.js';
import { localizeContent } from '../../../shared/content/index.js';
import { createRenderViewStateBuilder } from '../../../shared/viewStateBuilder.js';

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export class CobwebSessionHost {
  constructor({
    scenario = DEMO_SCENARIO,
    battleId = createBattleId(),
    snapshot = null,
    phaseCheckpoint = null,
    turnCheckpoint = null,
    mode = null,
  } = {}) {
    this.scenario = scenario;
    this.battleId = battleId;
    this.coreSession = null;
    this.pendingTransaction = null;
    this.nextTxId = 1;
    this.committedSnapshot = null;
    this.committedPhaseCheckpoint = null;
    this.committedTurnCheckpoint = null;
    this.initialLogs = [];
    this.initialResolution = null;
    this.presenter = null;
    this.content = { cards: {}, relics: {}, statuses: {}, enemies: {} };
    this.bootstrap = {
      snapshot,
      phaseCheckpoint,
      turnCheckpoint,
      mode,
    };
  }

  async ensureSession() {
    if (this.coreSession) return this;

    this.coreSession = await createSession(this.scenario, {
      snapshot: this.bootstrap.snapshot ?? null,
      phaseCheckpoint: this.bootstrap.phaseCheckpoint ?? null,
      turnCheckpoint: this.bootstrap.turnCheckpoint ?? null,
    });
    this.presenter = createRenderViewStateBuilder(this.coreSession.presenterParams ?? {});
    this.content = localizeContent(
      this.coreSession.content ?? this.content,
      this.coreSession.presenterParams?.lang ?? this.scenario?.lang ?? 'zh',
    );
    this.initialLogs = this.coreSession.initialLogs ?? [];
    this.initialResolution = this._toRenderResolution(this.coreSession.initialResolution ?? null);
    this.committedSnapshot = cloneValue(this.coreSession.getStateSnapshot?.() ?? null);
    this.committedPhaseCheckpoint = cloneValue(this.coreSession.getPhaseCheckpoint?.() ?? null);
    this.committedTurnCheckpoint = cloneValue(this.coreSession.getTurnCheckpoint?.() ?? null);
    return this;
  }

  async getReadyViewState() {
    await this.ensureSession();
    return this.getViewState();
  }

  getSession() {
    return this;
  }

  getBattleId() {
    return this.battleId;
  }

  getScenario() {
    return this.scenario;
  }

  getContent() {
    return this.content;
  }

  getAvailableCommands() {
    if (this.pendingTransaction) return [];
    return this.coreSession?.getAvailableCommands?.() ?? [];
  }

  can(commandType) {
    if (this.pendingTransaction) {
      return {
        commandType,
        currentPhase: this.getViewState()?.phase ?? null,
        requiredPhase: null,
        allowed: false,
        reason: 'render_pending',
      };
    }
    return this.coreSession?.can?.(commandType) ?? {
      commandType,
      currentPhase: this.getViewState()?.phase ?? null,
      requiredPhase: null,
      allowed: false,
      reason: 'unknown_command',
    };
  }

  getViewState() {
    const raw = this.coreSession?.getStateSnapshot?.() ?? null;
    return raw ? this.presenter?.buildViewState(raw) : null;
  }

  getStateSnapshot() {
    return cloneValue(this.committedSnapshot);
  }

  getPhaseCheckpoint() {
    return cloneValue(this.committedPhaseCheckpoint);
  }

  getTurnCheckpoint() {
    return cloneValue(this.committedTurnCheckpoint);
  }

  _buildPendingResult() {
    return {
      success: false,
      reason: 'render_pending',
      logs: [],
      state: this.getViewState(),
      resolution: null,
    };
  }

  _syncCommittedState() {
    this.pendingTransaction = null;
    this.committedSnapshot = cloneValue(this.coreSession?.getStateSnapshot?.() ?? null);
    this.committedPhaseCheckpoint = cloneValue(this.coreSession?.getPhaseCheckpoint?.() ?? null);
    this.committedTurnCheckpoint = cloneValue(this.coreSession?.getTurnCheckpoint?.() ?? null);
  }

  _toRenderResolution(resolution) {
    return buildRenderResolution(resolution);
  }

  _stageResult(result) {
    if (!result?.success) return result;

    const state = result.state ?? this.getViewState();
    const txId = this.nextTxId++;
    const stagedResult = {
      ...result,
      resolution: this._toRenderResolution(result.resolution),
      state,
      txId,
      committed: false,
    };

    this.pendingTransaction = {
      txId,
      snapshot: cloneValue(this.coreSession?.getStateSnapshot?.() ?? null),
      phaseCheckpoint: cloneValue(this.coreSession?.getPhaseCheckpoint?.() ?? null),
      turnCheckpoint: cloneValue(this.coreSession?.getTurnCheckpoint?.() ?? null),
      result: stagedResult,
    };

    return stagedResult;
  }

  _runCommand(methodName, ...args) {
    if (this.pendingTransaction) return this._buildPendingResult();
    const method = this.coreSession?.[methodName];
    if (typeof method !== 'function') return null;
    return this._stageResult(method.apply(this.coreSession, args));
  }

  _runImmediate(methodName, ...args) {
    if (this.pendingTransaction) return this._buildPendingResult();
    const method = this.coreSession?.[methodName];
    if (typeof method !== 'function') return null;
    const result = method.apply(this.coreSession, args);
    if (result?.success) {
      this._syncCommittedState();
    }
    return result;
  }

  hasPendingTransaction() {
    return this.pendingTransaction != null;
  }

  getPendingTransaction() {
    if (!this.pendingTransaction) return null;
    return {
      txId: this.pendingTransaction.txId,
      snapshot: cloneValue(this.pendingTransaction.snapshot),
      phaseCheckpoint: cloneValue(this.pendingTransaction.phaseCheckpoint),
      turnCheckpoint: cloneValue(this.pendingTransaction.turnCheckpoint),
      meta: null,
    };
  }

  ackRender(txId) {
    if (!this.pendingTransaction || (txId != null && this.pendingTransaction.txId !== txId)) {
      return {
        success: false,
        reason: 'no_pending_transaction',
        state: this.getViewState(),
      };
    }

    const pending = this.pendingTransaction;
    this.pendingTransaction = null;
    this.committedSnapshot = cloneValue(pending.snapshot);
    this.committedPhaseCheckpoint = cloneValue(pending.phaseCheckpoint);
    this.committedTurnCheckpoint = cloneValue(pending.turnCheckpoint);

    return {
      success: true,
      txId: pending.txId,
      snapshot: this.getStateSnapshot(),
      state: pending.result?.state ?? this.getViewState(),
    };
  }

  play(instanceId, target = null) {
    return this._runCommand('play', instanceId, target);
  }

  discard(instanceId) {
    return this._runCommand('discard', instanceId);
  }

  endTurn() {
    return this._runCommand('endTurn');
  }

  claimReward(choice) {
    return this._runCommand('claimReward', choice);
  }

  skipReward() {
    return this._runCommand('skipReward');
  }

  buyShopItem(index) {
    return this._runCommand('buyShopItem', index);
  }

  leaveShop() {
    return this._runCommand('leaveShop');
  }

  debugAddGold(amount = 100) {
    return this._runCommand('debugAddGold', amount);
  }

  debugWinBattle() {
    return this._runCommand('debugWinBattle');
  }

  debugOpenReward() {
    return this._runCommand('debugOpenReward');
  }

  debugOpenShop() {
    return this._runCommand('debugOpenShop');
  }

  restorePhase(snapshot) {
    return this._runImmediate('restorePhase', snapshot);
  }

  restoreTurn(snapshot) {
    return this._runImmediate('restoreTurn', snapshot);
  }

  getBootstrapMode(defaultMode = null) {
    return this.bootstrap.mode ?? defaultMode;
  }

  buildSceneData(extra = {}) {
    return {
      host: this,
      ...extra,
    };
  }
}

export function createCobwebSessionHost(options = {}) {
  return new CobwebSessionHost(options);
}



