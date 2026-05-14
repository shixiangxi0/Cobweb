import { describe, expect, it } from 'vitest';

import {
  buildRenderResolution,
  buildRenderStepsFromTimeline,
} from '../renderStepInterpreter.js';

describe('renderStepInterpreter', () => {
  it('rebuilds attack chains from raw timeline data on the render side', () => {
    const steps = buildRenderStepsFromTimeline([
      {
        bundleIndex: 0,
        seq: 1,
        event: 'card:play',
        payload: { instanceId: 'bash_1', cardId: 'bash', target: 'jaw_worm_1', cost: 2 },
      },
      {
        bundleIndex: 0,
        seq: 2,
        parentSeq: 1,
        rootSeq: 1,
        event: 'entity:attack',
        payload: { source: 'player', target: 'jaw_worm_1', amount: 8, cardId: 'bash', instanceId: 'bash_1' },
      },
      {
        bundleIndex: 0,
        seq: 3,
        parentSeq: 2,
        rootSeq: 1,
        event: 'entity:damage',
        causeBy: 'core:entity:attack',
        payload: { source: 'player', target: 'jaw_worm_1', amount: 8, blocked: 2, actualDamage: 6, cardId: 'bash', instanceId: 'bash_1' },
      },
      {
        bundleIndex: 0,
        seq: 4,
        parentSeq: 3,
        rootSeq: 1,
        event: 'entity:loss',
        causeBy: 'core:entity:damage:loss',
        payload: { source: 'player', target: 'jaw_worm_1', amount: 6, actualLoss: 6, cardId: 'bash', instanceId: 'bash_1' },
      },
    ]);

    expect(steps).toEqual([
      {
        kind: 'play_card',
        seq: 1,
        actor: 'player',
        target: 'jaw_worm_1',
        refs: { cardId: 'bash', instanceId: 'bash_1', sequenceId: '0:1', sequenceKind: 'play_card' },
        data: { cost: 2 },
        sources: [{ bundleIndex: 0, seq: 1, event: 'card:play' }],
      },
      {
        kind: 'attack',
        seq: 2,
        actor: 'player',
        target: 'jaw_worm_1',
        refs: { actionId: null, cardId: 'bash', instanceId: 'bash_1', sequenceId: '0:1', sequenceKind: 'play_card' },
        data: { amount: 8, blocked: 2, actualDamage: 6, actualLoss: 6, fatal: false },
        sources: [
          { bundleIndex: 0, seq: 2, event: 'entity:attack' },
          { bundleIndex: 0, seq: 3, event: 'entity:damage' },
          { bundleIndex: 0, seq: 4, event: 'entity:loss' },
        ],
      },
    ]);
  });

  it('falls back to existing steps when no raw timeline is available', () => {
    expect(buildRenderResolution({
      command: { type: 'noop' },
      steps: [{ kind: 'battle_start', refs: { marker: true }, data: { ok: true } }],
    })).toEqual({
      command: { type: 'noop' },
      steps: [{ kind: 'battle_start', refs: { marker: true }, data: { ok: true }, sources: [] }],
    });
  });
});
