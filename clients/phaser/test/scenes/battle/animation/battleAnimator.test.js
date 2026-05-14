import { describe, expect, it, vi } from 'vitest';

import { BattleAnimator } from '../../../../scenes/battle/animation/battleAnimator.js';

function createAnimator() {
  return new BattleAnimator({
    tweens: {
      add: vi.fn(),
      killTweensOf: vi.fn(),
    },
    add: {
      graphics: vi.fn(() => ({
        setPosition: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    },
  }, {
    animQueue: {
      wait: vi.fn(async () => {}),
    },
    ui: {},
    layout: {},
    getHandNode: vi.fn(() => null),
    getHandNodes: vi.fn(() => new Map()),
    beginResolvingCard: vi.fn(() => null),
    beginZoneTransition: vi.fn(() => null),
    removeHandNode: vi.fn(() => null),
    applyRenderPatch: vi.fn(),
    resolveActorNode: vi.fn(() => null),
    resolveActorAnchor: vi.fn(() => ({ x: 100, y: 100 })),
    beginActorMotion: vi.fn(() => null),
    endActorMotion: vi.fn(() => null),
    actorName: vi.fn(() => 'Unit'),
    statusLabel: vi.fn(() => 'Status'),
    playFlowStep: vi.fn(async () => false),
  });
}

describe('BattleAnimator', () => {
  it('plays sequence clips with the root action before nested clips', async () => {
    const animator = createAnimator();
    const calls = [];

    animator.animatePlayCard = vi.fn(async () => {
      calls.push('play_card');
    });
    animator.animateAttack = vi.fn(async () => {
      calls.push('attack');
    });
    animator.spawnImpactBurst = vi.fn();

    await animator.playClip({
      kind: 'sequence',
      sequenceKind: 'play_card',
      rootStep: { kind: 'play_card', target: 'slime_1', refs: { instanceId: 'strike_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
      clips: [
        { kind: 'single', step: { kind: 'attack', actor: 'player', target: 'slime_1' } },
      ],
    });

    expect(calls).toEqual(['play_card', 'attack']);
    expect(animator.spawnImpactBurst).toHaveBeenCalledTimes(1);
  });

  it('plays proc-source effects when a nested clip switches hook source', async () => {
    const animator = createAnimator();
    const procSources = [];

    animator.animatePlayCard = vi.fn(async () => {});
    animator.animateBlock = vi.fn(async () => {});
    animator.animateStatus = vi.fn(async () => {});
    animator.playProcSourceEffect = vi.fn(async (procSource) => {
      procSources.push(procSource);
      return true;
    });
    animator.spawnImpactBurst = vi.fn();

    await animator.playClip({
      kind: 'sequence',
      sequenceKind: 'play_card',
      rootStep: { kind: 'play_card', refs: { instanceId: 'shrug_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
      clips: [
        { kind: 'single', step: { kind: 'gain_block', refs: { procSource: 'shrug_1' } } },
        { kind: 'single', step: { kind: 'card_drawn', refs: { procSource: 'shrug_1' } } },
        { kind: 'single', step: { kind: 'apply_status', refs: { procSource: 'draw_strength_1', statusId: 'strength' } } },
      ],
    });

    expect(procSources).toEqual(['shrug_1', 'draw_strength_1']);
  });

  it('adds a hand-level prelude before discard batches driven by the played card', async () => {
    const animator = createAnimator();
    const calls = [];

    animator.animatePlayCard = vi.fn(async () => {
      calls.push('play_card');
    });
    animator.animateZoneBatch = vi.fn(async () => {
      calls.push('zone_batch');
    });
    animator.playProcSourceEffect = vi.fn(async () => {
      calls.push('proc_source');
      return true;
    });
    animator.playHandBatchPrelude = vi.fn(async () => {
      calls.push('hand_prelude');
      return true;
    });
    animator.spawnImpactBurst = vi.fn();

    await animator.playClip({
      kind: 'sequence',
      sequenceKind: 'play_card',
      rootStep: { kind: 'play_card', refs: { instanceId: 'mulligan_1', sequenceId: '0:1', sequenceKind: 'play_card' } },
      clips: [
        {
          kind: 'zone_batch',
          zoneKind: 'discarded',
          steps: [
            { kind: 'card_discarded', refs: { instanceId: 'strike_1', procSource: 'mulligan_1' } },
            { kind: 'card_discarded', refs: { instanceId: 'defend_1', procSource: 'mulligan_1' } },
          ],
        },
      ],
    });

    expect(calls).toEqual(['play_card', 'proc_source', 'hand_prelude', 'zone_batch']);
  });
});
