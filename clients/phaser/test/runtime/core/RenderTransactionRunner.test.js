import { describe, expect, it } from 'vitest';

import { RenderTransactionRunner } from '../../../src/runtime/core/RenderTransactionRunner.js';

describe('RenderTransactionRunner', () => {
  it('builds clip tasks for non-empty transactions and commits them explicitly', async () => {
    const started = [];
    const committed = [];
    const enqueued = [];
    const played = [];

    const runner = new RenderTransactionRunner({
      buildClips: (steps, transaction) => steps.map((step) => `${transaction.id}:${step.kind}`),
      enqueueTasks: (tasks, transaction) => {
        enqueued.push({ tasks, transaction });
      },
      playClip: async (clip, transaction) => {
        played.push({ clip, id: transaction.id });
      },
      onTransactionStart: (transaction) => started.push(transaction),
      onTransactionCommit: (transaction) => committed.push(transaction),
    });

    const transaction = runner.begin(
      { steps: [{ kind: 'draw' }, { kind: 'attack' }] },
      {
        transactionId: 7,
        afterState: { phase: 'battle', turn: 2 },
        meta: { source: 'test' },
      },
    );

    expect(transaction).toMatchObject({
      id: 7,
      afterState: { phase: 'battle', turn: 2 },
      meta: { source: 'test' },
    });
    expect(runner.hasPending()).toBe(true);
    expect(started).toHaveLength(1);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].tasks).toHaveLength(2);

    await enqueued[0].tasks[0]();
    await enqueued[0].tasks[1]();

    expect(played).toEqual([
      { clip: '7:draw', id: 7 },
      { clip: '7:attack', id: 7 },
    ]);
    expect(runner.complete(6)).toBeNull();

    const settled = runner.complete(7);

    expect(settled).toMatchObject({
      id: 7,
      afterState: { phase: 'battle', turn: 2 },
      meta: { source: 'test' },
    });
    expect(committed).toHaveLength(1);
    expect(runner.hasPending()).toBe(false);
  });

  it('auto-commits empty transactions and advances transaction ids', () => {
    const started = [];
    const committed = [];

    const runner = new RenderTransactionRunner({
      onTransactionStart: (transaction) => started.push(transaction),
      onTransactionCommit: (transaction) => committed.push(transaction),
    });

    const first = runner.begin({ steps: [] });
    const second = runner.begin({ steps: [] });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(started.map((transaction) => transaction.id)).toEqual([1, 2]);
    expect(committed.map((transaction) => transaction.id)).toEqual([1, 2]);
    expect(runner.hasPending()).toBe(false);
  });

  it('auto-commits when the resolution has steps but the active scene builds no clips', () => {
    const committed = [];

    const runner = new RenderTransactionRunner({
      buildClips: () => [],
      enqueueTasks: () => {
        throw new Error('should not enqueue tasks when no clips are built');
      },
      onTransactionCommit: (transaction) => committed.push(transaction),
    });

    const transaction = runner.begin({ steps: [{ kind: 'shop_enter' }] });

    expect(transaction.id).toBe(1);
    expect(committed.map((entry) => entry.id)).toEqual([1]);
    expect(runner.hasPending()).toBe(false);
  });
});
