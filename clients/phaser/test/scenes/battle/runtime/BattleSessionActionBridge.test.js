import { describe, expect, it, vi } from 'vitest';

import { BattleSessionActionBridge } from '../../../../scenes/battle/runtime/BattleSessionActionBridge.js';

describe('BattleSessionActionBridge', () => {
  it('maps play actions onto the session and installs battle-specific callbacks', () => {
    const actionDriver = { run: vi.fn() };
    const session = { play: vi.fn(() => ({ success: true })) };
    const onPlayFailure = vi.fn();
    const onBeforePlayApply = vi.fn();
    const bridge = new BattleSessionActionBridge({
      getSession: () => session,
      actionDriver,
      onPlayFailure,
      onBeforePlayApply,
    });

    bridge.play('card_1', 'enemy_1');

    expect(actionDriver.run).toHaveBeenCalledTimes(1);
    const [run, options] = actionDriver.run.mock.calls[0];
    expect(run()).toEqual({ success: true });
    expect(session.play).toHaveBeenCalledWith('card_1', 'enemy_1');
    expect(options.failureMessages).toEqual({});
    expect(options.defaultFailureText).toBe('');

    options.onFailure?.({ reason: 'cancelled' });
    options.beforeApply?.();
    expect(onPlayFailure).toHaveBeenCalledWith({ reason: 'cancelled' });
    expect(onBeforePlayApply).toHaveBeenCalledWith('card_1');
  });

  it('uses locale-provided failure messages when locale is given', () => {
    const actionDriver = { run: vi.fn() };
    const session = { play: vi.fn(() => ({ success: false, reason: 'not_in_hand' })) };
    const locale = {
      error: {
        play: {
          not_in_hand: 'This card is no longer in hand.',
          default: 'Play failed.',
        },
      },
    };
    const bridge = new BattleSessionActionBridge({
      getSession: () => session,
      actionDriver,
      locale,
    });

    bridge.play('card_1', 'enemy_1');

    const [, options] = actionDriver.run.mock.calls[0];
    expect(options.failureMessages).toEqual({ not_in_hand: 'This card is no longer in hand.' });
    expect(options.defaultFailureText).toBe('Play failed.');
  });

  it('notifies turn checkpoint persistence only after a battle turn commits', () => {
    const actionDriver = { run: vi.fn() };
    const session = { endTurn: vi.fn(() => ({ success: true })) };
    const onTurnCommitted = vi.fn();
    const bridge = new BattleSessionActionBridge({
      getSession: () => session,
      actionDriver,
      onTurnCommitted,
    });

    bridge.endTurn();

    const [, options] = actionDriver.run.mock.calls[0];
    options.onCommitted?.({ phase: 'battle', turn: 3 }, { id: 9 });
    options.onCommitted?.({ phase: 'reward', turn: 3 }, { id: 10 });

    expect(onTurnCommitted).toHaveBeenCalledTimes(1);
    expect(onTurnCommitted).toHaveBeenCalledWith(3, { phase: 'battle', turn: 3 }, { id: 9 });
  });

  it('routes debug commands through a shared debug apply hook', () => {
    const actionDriver = { run: vi.fn() };
    const session = { debugOpenShop: vi.fn(() => ({ success: true, resolution: { command: { type: 'debug_open_shop' } } })) };
    const onDebugApplied = vi.fn();
    const bridge = new BattleSessionActionBridge({
      getSession: () => session,
      actionDriver,
      onDebugApplied,
    });

    bridge.debugOpenShop();

    const [run, options] = actionDriver.run.mock.calls[0];
    expect(run()).toMatchObject({ success: true });
    expect(session.debugOpenShop).toHaveBeenCalledTimes(1);

    const result = { success: true, state: { phase: 'shop' }, resolution: { command: { type: 'debug_open_shop' } } };
    options.afterApply?.(result);
    expect(onDebugApplied).toHaveBeenCalledWith(result);
    expect(options.defaultFailureText).toBe('调试命令未生效。');
  });
});
