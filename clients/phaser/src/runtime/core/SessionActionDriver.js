export class SessionActionDriver {
  constructor({
    hasPendingRenderTransaction = () => false,
    beginRenderTransaction = () => {},
    getFallbackState = () => null,
    resolveFailureText = () => '',
    showFailureText = () => {},
  } = {}) {
    this.hasPendingRenderTransaction = hasPendingRenderTransaction;
    this.beginRenderTransaction = beginRenderTransaction;
    this.getFallbackState = getFallbackState;
    this.resolveFailureText = resolveFailureText;
    this.showFailureText = showFailureText;
  }

  buildPendingRenderResult() {
    return {
      success: false,
      reason: 'render_pending',
      logs: [],
      state: this.getFallbackState(),
      resolution: null,
    };
  }

  applyResult(result, {
    failureMessages = {},
    defaultFailureText = '这一项暂时无法处理。',
    onFailure = null,
    beforeApply = null,
    afterApply = null,
    onCommitted = null,
  } = {}) {
    if (!result?.success) {
      const text = this.resolveFailureText(result, failureMessages, defaultFailureText);
      if (text) this.showFailureText(text);
      onFailure?.(result);
      return false;
    }

    beforeApply?.(result);
    this.beginRenderTransaction(result.resolution, {
      afterState: result.state ?? this.getFallbackState(),
      transactionId: result.txId ?? null,
      onCommitted,
    });
    afterApply?.(result);
    return true;
  }

  run(run, options = {}) {
    if (typeof run !== 'function') return null;

    if (this.hasPendingRenderTransaction()) {
      const busyResult = this.buildPendingRenderResult();
      const text = this.resolveFailureText(
        busyResult,
        {
          render_pending: '当前演出尚未完成。',
          ...(options.failureMessages ?? {}),
        },
        '当前演出尚未完成。',
      );
      if (text) this.showFailureText(text);
      return busyResult;
    }

    const result = run();
    this.applyResult(result, options);
    return result;
  }
}
