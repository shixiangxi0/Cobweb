import { describe, expect, it, vi } from 'vitest';

import { SessionActionDriver } from '../../../src/runtime/core/SessionActionDriver.js';

describe('SessionActionDriver', () => {
  it('pipes successful session results into render transactions', () => {
    const beginRenderTransaction = vi.fn();
    const beforeApply = vi.fn();
    const afterApply = vi.fn();
    const onCommitted = vi.fn();
    const driver = new SessionActionDriver({
      beginRenderTransaction,
      getFallbackState: () => ({ phase: 'battle', turn: 1 }),
    });

    const result = {
      success: true,
      txId: 42,
      resolution: { steps: [{ kind: 'attack' }] },
      state: { phase: 'reward', turn: 1 },
    };

    expect(driver.applyResult(result, {
      beforeApply,
      afterApply,
      onCommitted,
    })).toBe(true);

    expect(beforeApply).toHaveBeenCalledWith(result);
    expect(beginRenderTransaction).toHaveBeenCalledWith(result.resolution, {
      afterState: result.state,
      transactionId: 42,
      onCommitted,
    });
    expect(afterApply).toHaveBeenCalledWith(result);
  });

  it('reports failures without starting render transactions', () => {
    const beginRenderTransaction = vi.fn();
    const resolveFailureText = vi.fn(() => '这一项当前不可用。');
    const showFailureText = vi.fn();
    const onFailure = vi.fn();
    const driver = new SessionActionDriver({
      beginRenderTransaction,
      resolveFailureText,
      showFailureText,
    });

    const result = { success: false, reason: 'blocked', state: { phase: 'battle' } };

    expect(driver.applyResult(result, {
      failureMessages: { blocked: 'blocked' },
      onFailure,
    })).toBe(false);

    expect(resolveFailureText).toHaveBeenCalled();
    expect(showFailureText).toHaveBeenCalledWith('这一项当前不可用。');
    expect(onFailure).toHaveBeenCalledWith(result);
    expect(beginRenderTransaction).not.toHaveBeenCalled();
  });

  it('rejects new actions while a render transaction is pending', () => {
    const run = vi.fn(() => ({ success: true }));
    const showFailureText = vi.fn();
    const resolveFailureText = vi.fn((result, failureMessages, defaultFailureText) => (
      failureMessages[result.reason] ?? defaultFailureText
    ));
    const driver = new SessionActionDriver({
      hasPendingRenderTransaction: () => true,
      getFallbackState: () => ({ phase: 'battle', turn: 3 }),
      resolveFailureText,
      showFailureText,
    });

    const result = driver.run(run);

    expect(run).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      reason: 'render_pending',
      logs: [],
      state: { phase: 'battle', turn: 3 },
      resolution: null,
    });
    expect(showFailureText).toHaveBeenCalledWith('当前演出尚未完成。');
  });
});
