export class RenderTransactionRunner {
  constructor({
    buildClips = () => [],
    enqueueTasks = () => {},
    playClip = async () => {},
    onTransactionStart = null,
    onTransactionCommit = null,
  } = {}) {
    this.buildClips = buildClips;
    this.enqueueTasks = enqueueTasks;
    this.playClip = playClip;
    this.onTransactionStart = onTransactionStart;
    this.onTransactionCommit = onTransactionCommit;
    this.current = null;
    this.nextId = 1;
  }

  reset() {
    this.current = null;
    this.nextId = 1;
  }

  hasPending() {
    return !!this.current;
  }

  begin(resolution, { afterState = null, meta = null, onCommitted = null, transactionId = null } = {}) {
    const nextTransactionId = Number.isFinite(transactionId) ? Math.trunc(transactionId) : this.nextId;
    const transaction = {
      id: nextTransactionId,
      resolution,
      afterState,
      meta,
      onCommitted: typeof onCommitted === 'function' ? onCommitted : null,
    };
    this.nextId = Math.max(this.nextId, nextTransactionId + 1);
    this.current = transaction;
    this.onTransactionStart?.(transaction);

    const steps = resolution?.steps ?? [];
    if (steps.length === 0) {
      this.complete(transaction.id);
      return transaction;
    }

    const clips = this.buildClips(steps, transaction) ?? [];
    if (clips.length === 0) {
      this.complete(transaction.id);
      return transaction;
    }

    const tasks = clips.map((clip) => async () => {
      await this.playClip(clip, transaction);
    });
    this.enqueueTasks(tasks, transaction);
    return transaction;
  }

  complete(transactionId = this.current?.id ?? null) {
    if (!this.current) return null;
    if (transactionId != null && this.current.id !== transactionId) return null;

    const transaction = this.current;
    this.current = null;
    this.onTransactionCommit?.(transaction);
    return transaction;
  }
}
