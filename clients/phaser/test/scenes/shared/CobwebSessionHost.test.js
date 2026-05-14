import { describe, expect, it, vi, beforeEach } from 'vitest';

const { createSession } = vi.hoisted(() => ({
  createSession: vi.fn(),
}));

vi.mock('../../../../../games/sts/src/index.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSession,
}));

import { CobwebSessionHost } from '../../../scenes/shared/CobwebSessionHost.js';

function createCoreSessionStub(overrides = {}) {
  let currentSnapshot = overrides.initialSnapshot ?? {
    phase: 'battle',
    battle: { turn: 1 },
  };
  let phaseCheckpoint = overrides.phaseCheckpoint ?? { phase: 'battle', checkpoint: 'phase-start' };
  let turnCheckpoint = overrides.turnCheckpoint ?? { phase: 'battle', checkpoint: 'turn-start' };

  return {
    initialLogs: [],
    initialResolution: { steps: [{ kind: 'battle_start' }] },
    content: {
      cards: {
        defend: {
          id: 'defend',
          name: 'Defend',
          desc: 'Gain 5 Block.',
          type: 'skill',
          cost: 1,
          targetType: 'none',
          exhaust: false,
          display: {
            name: 'Defend',
            desc: 'Gain 5 Block.',
            type: 'skill',
          },
        },
      },
      relics: {},
      statuses: {},
      enemies: {},
    },
    presenterParams: {
      content: {
        cards: {
          defend: {
            id: 'defend',
            name: 'Defend',
            desc: 'Gain 5 Block.',
            type: 'skill',
            cost: 1,
            targetType: 'none',
            exhaust: false,
            display: {
              name: 'Defend',
              desc: 'Gain 5 Block.',
              type: 'skill',
            },
          },
        },
        relics: {},
        statuses: {},
        enemies: {},
      },
      lang: 'en',
    },
    getStateSnapshot: vi.fn(() => JSON.parse(JSON.stringify(currentSnapshot))),
    getViewState: vi.fn(() => ({ phase: currentSnapshot.phase, turn: currentSnapshot.battle?.turn ?? 1 })),
    getPhaseCheckpoint: vi.fn(() => JSON.parse(JSON.stringify(phaseCheckpoint))),
    getTurnCheckpoint: vi.fn(() => JSON.parse(JSON.stringify(turnCheckpoint))),
    getAvailableCommands: vi.fn(() => ['play_card', 'end_turn']),
    can: vi.fn((commandType) => ({
      commandType,
      currentPhase: currentSnapshot.phase,
      requiredPhase: 'battle',
      allowed: commandType === 'play_card' || commandType === 'end_turn',
      reason: commandType === 'play_card' || commandType === 'end_turn' ? null : 'phase_locked',
    })),
    play: vi.fn(() => {
      currentSnapshot = {
        phase: 'battle',
        battle: {
          turn: 1,
          hand: ['defend_1'],
          drawPile: [],
          discardPile: ['strike_1'],
          exhaustPile: [],
          entities: { player: { hp: 75, maxHp: 75, energy: 2, maxEnergy: 3, statuses: {} } },
          enemies: {},
          cards: {
            defend_1: { cardId: 'defend', cost: 1 },
          },
        },
      };
      phaseCheckpoint = { phase: 'battle', checkpoint: 'phase-after-play' };
      turnCheckpoint = { phase: 'battle', checkpoint: 'turn-after-play' };
      return {
        success: true,
        logs: ['played'],
        resolution: { steps: [{ kind: 'play_card' }] },
      };
    }),
    endTurn: vi.fn(() => {
      currentSnapshot = {
        phase: 'battle',
        battle: {
          turn: 2,
          hand: [],
          drawPile: [],
          discardPile: [],
          exhaustPile: [],
          enemies: {},
          entities: {
            player: { hp: 75, maxHp: 75, energy: 3, maxEnergy: 3, statuses: {} },
          },
          cards: {},
        },
      };
      phaseCheckpoint = { phase: 'battle', checkpoint: 'phase-after-turn' };
      turnCheckpoint = { phase: 'battle', checkpoint: 'turn-2-start' };
      return {
        success: true,
        logs: ['end turn'],
        state: { phase: 'battle', turn: 2 },
        resolution: { steps: [{ kind: 'turn_end' }, { kind: 'turn_start' }] },
      };
    }),
    ...overrides,
  };
}

describe('CobwebSessionHost', () => {
  beforeEach(() => {
    createSession.mockReset();
  });

  it('wraps a non-render-transactional core session with host-managed pending/ack state', async () => {
    const coreSession = createCoreSessionStub({
      initialSnapshot: {
        phase: 'battle',
        battle: { turn: 1, hand: ['strike_1'] },
      },
    });
    createSession.mockResolvedValue(coreSession);

    const host = new CobwebSessionHost();
    const session = await host.ensureSession();

    expect(createSession).toHaveBeenCalledWith(expect.anything(), {
      snapshot: null,
      phaseCheckpoint: null,
      turnCheckpoint: null,
    });
    expect(session.getStateSnapshot()).toEqual({
      phase: 'battle',
      battle: { turn: 1, hand: ['strike_1'] },
    });

    const result = session.play('strike_1', 'enemy_1');
    expect(result).toMatchObject({
      success: true,
      txId: 1,
      committed: false,
      state: {
        phase: 'battle',
        hand: [{ instanceId: 'defend_1', cardId: 'defend' }],
        piles: { draw: 0, discard: 1, exhaust: 0 },
      },
    });
    expect(session.hasPendingTransaction()).toBe(true);
    expect(session.getStateSnapshot()).toEqual({
      phase: 'battle',
      battle: { turn: 1, hand: ['strike_1'] },
    });
    expect(host.getPendingTransaction()).toMatchObject({
      txId: 1,
      snapshot: {
        phase: 'battle',
        battle: { turn: 1, hand: ['defend_1'] },
      },
    });

    expect(coreSession.getStateSnapshot()).toMatchObject({
      phase: 'battle',
      battle: {
        turn: 1,
        hand: ['defend_1'],
        discardPile: ['strike_1'],
      },
    });

    const ack = host.ackRender(1);
    expect(ack).toMatchObject({
      success: true,
      txId: 1,
      state: {
        phase: 'battle',
        turn: 1,
        hand: [{ instanceId: 'defend_1', cardId: 'defend' }],
        piles: { draw: 0, discard: 1, exhaust: 0 },
      },
    });
    expect(session.hasPendingTransaction()).toBe(false);
    expect(session.getStateSnapshot()).toMatchObject({
      phase: 'battle',
      battle: {
        turn: 1,
        hand: ['defend_1'],
        discardPile: ['strike_1'],
      },
    });
    expect(session.getTurnCheckpoint()).toEqual({ phase: 'battle', checkpoint: 'turn-after-play' });
  });

  it('keeps the host-side committed checkpoint state stable until the render transaction is acknowledged', async () => {
    const coreSession = createCoreSessionStub();
    createSession.mockResolvedValue(coreSession);

    const host = new CobwebSessionHost();
    const session = await host.ensureSession();

    session.endTurn();

    expect(session.getTurnCheckpoint()).toEqual({ phase: 'battle', checkpoint: 'turn-start' });
    expect(host.getPendingTransaction()).toMatchObject({ txId: 1 });

    session.ackRender(1);
    expect(session.getTurnCheckpoint()).toEqual({ phase: 'battle', checkpoint: 'turn-2-start' });
  });

  it('projects raw timeline resolution into render steps for phaser consumers', async () => {
    const coreSession = createCoreSessionStub({
      initialSnapshot: {
        phase: 'battle',
        battle: {
          turn: 1,
          hand: [],
          drawPile: [],
          discardPile: [],
          exhaustPile: [],
          enemies: {},
          entities: {
            player: { hp: 75, maxHp: 75, energy: 3, maxEnergy: 3, statuses: {} },
          },
          cards: {},
        },
      },
      initialResolution: {
        debug: {
          timeline: [
            { bundleIndex: 0, seq: 1, event: 'battle:start', payload: {} },
            { bundleIndex: 0, seq: 2, event: 'player:turn:start', payload: {} },
          ],
        },
        steps: [],
      },
      play: vi.fn(() => ({
        success: true,
        logs: ['played'],
        resolution: {
          debug: {
            timeline: [
              { bundleIndex: 0, seq: 1, event: 'card:play', payload: { instanceId: 'defend_1', cardId: 'defend', cost: 1 } },
              {
                bundleIndex: 0,
                seq: 2,
                parentSeq: 1,
                rootSeq: 1,
                event: 'entity:block',
                payload: { target: 'player', amount: 5 },
              },
            ],
          },
          steps: [],
        },
      })),
    });
    createSession.mockResolvedValue(coreSession);

    const host = new CobwebSessionHost();
    await host.ensureSession();

    expect(host.initialResolution?.steps).toEqual([
      { kind: 'battle_start', seq: 1, actor: null, target: null, refs: {}, data: {}, sources: [{ bundleIndex: 0, seq: 1, event: 'battle:start' }] },
      { kind: 'turn_start', seq: 2, actor: 'player', target: null, refs: {}, data: {}, sources: [{ bundleIndex: 0, seq: 2, event: 'player:turn:start' }] },
    ]);

    const result = host.play('defend_1');
    expect(result?.resolution?.steps).toEqual([
      {
        kind: 'play_card',
        seq: 1,
        actor: 'player',
        target: null,
        refs: { cardId: 'defend', instanceId: 'defend_1', sequenceId: '0:1', sequenceKind: 'play_card' },
        data: { cost: 1 },
        sources: [{ bundleIndex: 0, seq: 1, event: 'card:play' }],
      },
      {
        kind: 'gain_block',
        seq: 2,
        actor: null,
        target: 'player',
        refs: { sequenceId: '0:1', sequenceKind: 'play_card' },
        data: { target: 'player', amount: 5 },
        sources: [{ bundleIndex: 0, seq: 2, event: 'entity:block' }],
      },
    ]);
  });

  it('exposes command capabilities and blocks them while render ack is pending', async () => {
    const coreSession = createCoreSessionStub();
    createSession.mockResolvedValue(coreSession);

    const host = new CobwebSessionHost();
    await host.ensureSession();

    expect(host.getAvailableCommands()).toEqual(['play_card', 'end_turn']);
    expect(host.can('play_card')).toMatchObject({
      commandType: 'play_card',
      allowed: true,
      reason: null,
    });

    host.endTurn();

    expect(host.getAvailableCommands()).toEqual([]);
    expect(host.can('play_card')).toMatchObject({
      commandType: 'play_card',
      allowed: false,
      reason: 'render_pending',
    });
  });
});
