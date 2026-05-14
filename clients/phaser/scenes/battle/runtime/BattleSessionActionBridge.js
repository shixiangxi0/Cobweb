import { getErrorMessages } from '../../../../shared/locale.js';

export class BattleSessionActionBridge {
  constructor({
    getSession = () => null,
    actionDriver = null,
    onPlayFailure = null,
    onBeforePlayApply = null,
    onTurnCommitted = null,
    onDebugApplied = null,
    locale = null,
  } = {}) {
    this.getSession = getSession;
    this.actionDriver = actionDriver;
    this.onPlayFailure = onPlayFailure;
    this.onBeforePlayApply = onBeforePlayApply;
    this.onTurnCommitted = onTurnCommitted;
    this.onDebugApplied = onDebugApplied;
    this.locale = locale;
  }

  _failureMessages(action) {
    return this.locale ? getErrorMessages(this.locale, action) : {};
  }

  _defaultText(action) {
    return this.locale
      ? (this.locale.error?.[action]?.default ?? '')
      : '';
  }

  run(command, options = {}) {
    if (typeof command !== 'function') return null;
    return this.actionDriver?.run?.(() => {
      const session = this.getSession?.();
      return session ? command(session) : null;
    }, options) ?? null;
  }

  play(instanceId, target = null) {
    return this.run(
      (session) => session.play(instanceId, target),
      {
        failureMessages: this._failureMessages('play'),
        defaultFailureText: this._defaultText('play'),
        onFailure: (result) => this.onPlayFailure?.(result),
        beforeApply: () => this.onBeforePlayApply?.(instanceId),
      },
    );
  }

  endTurn() {
    return this.run(
      (session) => session.endTurn(),
      {
        defaultFailureText: this._defaultText('endTurn'),
        onCommitted: (state, transaction) => {
          if ((state?.phase ?? 'battle') === 'battle') {
            this.onTurnCommitted?.(state?.turn, state, transaction);
          }
        },
      },
    );
  }

  claimReward(choice) {
    return this.run(
      (session) => session.claimReward(choice),
      {
        failureMessages: this._failureMessages('claimReward'),
        defaultFailureText: this._defaultText('claimReward'),
      },
    );
  }

  skipReward() {
    return this.run(
      (session) => session.skipReward(),
      {
        failureMessages: this._failureMessages('skipReward'),
        defaultFailureText: this._defaultText('skipReward'),
      },
    );
  }

  buyShopItem(index) {
    return this.run(
      (session) => session.buyShopItem(index),
      {
        failureMessages: this._failureMessages('buyShopItem'),
        defaultFailureText: this._defaultText('buyShopItem'),
      },
    );
  }

  leaveShop() {
    return this.run(
      (session) => session.leaveShop(),
      {
        failureMessages: this._failureMessages('leaveShop'),
        defaultFailureText: this._defaultText('leaveShop'),
      },
    );
  }

  runDebugCommand(command, actionKey = 'default') {
    return this.run(command, {
      failureMessages: this._failureMessages(actionKey),
      defaultFailureText: this._defaultText(actionKey) || '调试命令未生效。',
      afterApply: (result) => this.onDebugApplied?.(result),
    });
  }

  debugAddGold(amount = 100) {
    return this.runDebugCommand((session) => session.debugAddGold(amount));
  }

  debugWinBattle() {
    return this.runDebugCommand((session) => session.debugWinBattle());
  }

  debugOpenReward() {
    return this.runDebugCommand((session) => session.debugOpenReward());
  }

  debugOpenShop() {
    return this.runDebugCommand((session) => session.debugOpenShop());
  }
}

