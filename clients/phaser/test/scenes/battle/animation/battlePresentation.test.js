import { describe, expect, it } from 'vitest';

import { buildBattleClips } from '../../../../scenes/battle/animation/battlePresentation.js';

describe('buildBattleClips', () => {
  it('groups a played card and its contiguous resolution steps into one sequence clip', () => {
    const clips = buildBattleClips([
      { kind: 'play_card', refs: { instanceId: 'bash_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
      { kind: 'attack', target: 'jaw_worm_1', refs: { sequenceId: '0:1', sequenceKind: 'play_card' } },
      { kind: 'apply_status', target: 'jaw_worm_1', refs: { statusId: 'vulnerable', sequenceId: '0:1', sequenceKind: 'play_card' } },
      { kind: 'card_moved', refs: { instanceId: 'shrug_2', sequenceId: '0:1', sequenceKind: 'play_card' }, data: { from: 'drawPile', to: 'hand' } },
      { kind: 'card_moved', refs: { instanceId: 'defend_3', sequenceId: '0:1', sequenceKind: 'play_card' }, data: { from: 'drawPile', to: 'hand' } },
      { kind: 'turn_end', actor: 'player' },
    ]);

    expect(clips).toHaveLength(2);
    expect(clips[0]).toEqual({
      kind: 'sequence',
      sequenceKind: 'play_card',
      rootStep: { kind: 'play_card', refs: { instanceId: 'bash_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
      clips: [
        { kind: 'single', step: { kind: 'attack', target: 'jaw_worm_1', refs: { sequenceId: '0:1', sequenceKind: 'play_card' } } },
        {
          kind: 'single',
          step: { kind: 'apply_status', target: 'jaw_worm_1', refs: { statusId: 'vulnerable', sequenceId: '0:1', sequenceKind: 'play_card' } },
        },
        {
          kind: 'draw_batch',
          steps: [
            { kind: 'card_moved', refs: { instanceId: 'shrug_2', sequenceId: '0:1', sequenceKind: 'play_card' }, data: { from: 'drawPile', to: 'hand' } },
            { kind: 'card_moved', refs: { instanceId: 'defend_3', sequenceId: '0:1', sequenceKind: 'play_card' }, data: { from: 'drawPile', to: 'hand' } },
          ],
        },
      ],
    });
    expect(clips[1]).toEqual({ kind: 'single', step: { kind: 'turn_end', actor: 'player' } });
  });

  it('splits draw batches when the proc source changes', () => {
    const clips = buildBattleClips([
      { kind: 'play_card', refs: { instanceId: 'shrug_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
      { kind: 'card_moved', refs: { instanceId: 'draw_strength_1', sequenceId: '0:1', sequenceKind: 'play_card', procSource: 'shrug_1' }, data: { from: 'drawPile', to: 'hand' } },
      { kind: 'card_moved', refs: { instanceId: 'defend_2', sequenceId: '0:1', sequenceKind: 'play_card', procSource: 'draw_strength_1' }, data: { from: 'drawPile', to: 'hand' } },
    ]);

    expect(clips).toEqual([
      {
        kind: 'sequence',
        sequenceKind: 'play_card',
        rootStep: { kind: 'play_card', refs: { instanceId: 'shrug_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
        clips: [
          {
            kind: 'draw_batch',
            steps: [
              { kind: 'card_moved', refs: { instanceId: 'draw_strength_1', sequenceId: '0:1', sequenceKind: 'play_card', procSource: 'shrug_1' }, data: { from: 'drawPile', to: 'hand' } },
            ],
          },
          {
            kind: 'draw_batch',
            steps: [
              { kind: 'card_moved', refs: { instanceId: 'defend_2', sequenceId: '0:1', sequenceKind: 'play_card', procSource: 'draw_strength_1' }, data: { from: 'drawPile', to: 'hand' } },
            ],
          },
        ],
      },
    ]);
  });

  it('groups an enemy action with its follow-up combat steps and stops before flow transitions', () => {
    const clips = buildBattleClips([
      { kind: 'enemy_action', actor: 'slime_1', refs: { sequenceId: '0:5', sequenceKind: 'enemy_action' } },
      { kind: 'attack', actor: 'slime_1', target: 'player', refs: { sequenceId: '0:5', sequenceKind: 'enemy_action' } },
      { kind: 'battle_end', data: { victory: false }, refs: { sequenceId: '0:5', sequenceKind: 'enemy_action' } },
      { kind: 'reward_open' },
    ]);

    expect(clips).toHaveLength(2);
    expect(clips[0]).toEqual({
      kind: 'sequence',
      sequenceKind: 'enemy_action',
      rootStep: { kind: 'enemy_action', actor: 'slime_1', refs: { sequenceId: '0:5', sequenceKind: 'enemy_action' } },
      clips: [
        { kind: 'single', step: { kind: 'attack', actor: 'slime_1', target: 'player', refs: { sequenceId: '0:5', sequenceKind: 'enemy_action' } } },
        { kind: 'single', step: { kind: 'battle_end', data: { victory: false }, refs: { sequenceId: '0:5', sequenceKind: 'enemy_action' } } },
      ],
    });
    expect(clips[1]).toEqual({ kind: 'single', step: { kind: 'reward_open' } });
  });
});
