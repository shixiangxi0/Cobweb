import { createSession } from '../../games/sts/src/index.js';
import { createLogContext, createPresenter } from './presenter.js';
import { summarizeResolution } from './summarize.js';

const ACTION_COMMAND_TYPES = Object.freeze({
  play: 'play_card',
  discard: 'discard_card',
  endTurn: 'end_turn',
  claimReward: 'claim_reward',
  skipReward: 'skip_reward',
  buyShopItem: 'buy_shop_item',
  leaveShop: 'leave_shop',
});

/**
 * SessionController — 渲染层共享的游戏会话控制器。
 *
 * 职责：
 *   - 管理 session 生命周期（创建、销毁）
 *   - 统一动作分发（dispatch）
 *   - 管理日志累积
 *   - 管理检查点（save / load / undo）
 *   - 暴露可订阅的状态（viewState、logs）
 *
 * 渲染层只需：
 *   1. 创建 controller
 *   2. 订阅状态变化 → 重新渲染
 *   3. 用户输入 → controller.dispatch(action, payload)
 */
export class SessionController {
  constructor({
    scenario = null,
    checkpointStore = null,
    presenterFactory = createPresenter,
  } = {}) {
    this.scenario = scenario;
    this.checkpointStore = checkpointStore;
    this.presenterFactory = presenterFactory;
    this.session = null;
    this.presenter = null;
    this.logContext = null;
    this.content = { cards: {}, relics: {}, statuses: {}, enemies: {} };
    this.logs = [];
    this.subscribers = new Set();
    this.startTime = null;
  }

  async init() {
    this.session = await createSession(this.scenario);
    this.presenter = this.presenterFactory(this.session.presenterParams ?? {});
    this.logContext = createLogContext(this.session.presenterParams ?? {});
    this.content = this.presenter?.content ?? this.session?.content ?? this.content;
    this.startTime = Date.now();
    this.logs.push(...this._resolveLogs({
      logs: this.session.initialLogs,
      resolution: this.session.initialResolution,
    }));
    this._notify();
  }

  _resolveLogs(result = {}) {
    if (Array.isArray(result?.logs) && result.logs.length > 0) return result.logs;
    if (result?.success === false) return [];
    if (!result?.resolution || !this.logContext) return [];
    return summarizeResolution(
      result.resolution,
      this.logContext.buildCtx(() => this.session?.getStateSnapshot?.() ?? null),
    );
  }

  getPlayTime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  static formatPlayTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m${s.toString().padStart(2, '0')}s`;
    return `${m}m${s.toString().padStart(2, '0')}s`;
  }

  /**
   * 统一动作分发。
   * @param {string} action   'play' | 'endTurn' | 'claimReward' | 'skipReward' | 'buyShopItem' | 'leaveShop'
   * @param {object} payload  动作参数
   * @returns {object|null}   session 返回的 result
   */
  dispatch(action, payload = {}) {
    if (!this.session) return null;

    let result;
    switch (action) {
      case 'play':
        result = this.session.play(payload.instanceId, payload.target);
        break;
      case 'endTurn':
        result = this.session.endTurn();
        break;
      case 'claimReward':
        result = this.session.claimReward(payload);
        break;
      case 'skipReward':
        result = this.session.skipReward();
        break;
      case 'buyShopItem':
        result = this.session.buyShopItem(payload.index);
        break;
      case 'leaveShop':
        result = this.session.leaveShop();
        break;
      case 'discard':
        result = this.session.discard(payload.instanceId);
        break;
      default:
        return null;
    }

    this.logs.push(...this._resolveLogs(result));

    this._notify();
    return result;
  }

  // ── 检查点 ────────────────────────────────────────────────────────────

  _validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return false;
    }
    if (snapshot.phase !== 'battle') return false;
    const battle = snapshot.battle;
    if (!battle || typeof battle !== 'object' || Array.isArray(battle)) return false;
    if (!battle.entities || typeof battle.entities !== 'object') return false;
    if (!battle.entities.player || typeof battle.entities.player !== 'object') return false;
    if (!Array.isArray(battle.hand)) return false;
    return true;
  }

  listSaveSlots() {
    return this.checkpointStore?.list() ?? Array.from({ length: 3 }, () => null);
  }

  async saveToSlot(index) {
    const snapshot = this.session?.getTurnCheckpoint();
    if (!snapshot) return { success: false, reason: 'no_turn_checkpoint' };
    const playTime = this.getPlayTime();
    const name = SessionController.formatPlayTime(playTime);
    const saved = this.checkpointStore?.saveSlot?.(index, {
      snapshot,
      name,
      playTime,
      turn: this.viewState?.turn ?? 0,
    });
    if (!saved) return { success: false, reason: 'slot_invalid' };
    return { success: true, index, name, turn: this.viewState?.turn ?? 0 };
  }

  async loadFromSlot(index) {
    const snapshot = this.checkpointStore?.loadSlot?.(index);
    if (!snapshot) return { success: false, reason: 'slot_empty' };
    if (!this._validateSnapshot(snapshot)) {
      return { success: false, reason: 'invalid_snapshot' };
    }
    const result = this.session?.restoreTurn?.(snapshot);
    this.logs = [];
    this.logs.push(...this._resolveLogs(result));
    this._notify();
    return result;
  }

  undo() {
    const result = this.session?.restoreTurn?.();
    this.logs = [];
    this.logs.push(...this._resolveLogs(result));
    this._notify();
    return result;
  }

  // ── 调试命令 ──────────────────────────────────────────────────────────

  debugAddGold(amount) { return this._debug('debugAddGold', amount); }
  debugWinBattle() { return this._debug('debugWinBattle'); }
  debugOpenReward() { return this._debug('debugOpenReward'); }
  debugOpenShop() { return this._debug('debugOpenShop'); }

  _debug(method, ...args) {
    if (!this.session?.[method]) return null;
    const result = this.session[method](...args);
    this.logs.push(...this._resolveLogs(result));
    this._notify();
    return result;
  }

  // ── 状态访问 ──────────────────────────────────────────────────────────

  get viewState() {
    const raw = this.session?.getStateSnapshot() ?? null;
    return raw ? this.presenter?.buildViewState(raw) : null;
  }

  get isReady() {
    return !!this.session;
  }

  get phase() {
    return this.viewState?.phase ?? 'battle';
  }

  getAvailableActions() {
    const available = new Set(this.session?.getAvailableCommands?.() ?? []);
    return Object.fromEntries(
      Object.entries(ACTION_COMMAND_TYPES).map(([action, commandType]) => [action, available.has(commandType)]),
    );
  }

  can(action) {
    if (!this.session) {
      return {
        action,
        commandType: ACTION_COMMAND_TYPES[action] ?? null,
        allowed: false,
        reason: 'session_unavailable',
      };
    }
    const commandType = ACTION_COMMAND_TYPES[action] ?? null;
    if (!commandType) {
      return {
        action,
        commandType: null,
        allowed: false,
        reason: 'unknown_action',
      };
    }
    return {
      action,
      ...this.session.can(commandType),
    };
  }

  // ── 订阅 ──────────────────────────────────────────────────────────────

  subscribe(fn) {
    this.subscribers.add(fn);
  }

  unsubscribe(fn) {
    this.subscribers.delete(fn);
  }

  _notify() {
    this.subscribers.forEach((fn) => fn(this));
  }
}
