import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SessionController } from '../../../../../clients/ink-cli/SessionController.js';

vi.mock('../../../src/index.js', () => ({
  createSession: vi.fn(),
}));

import { createSession } from '../../../src/index.js';

describe('SessionController (mock session)', () => {
  function makeMockSession(overrides = {}) {
    return {
      getStateSnapshot: vi.fn(() => ({ phase: 'battle', battle: { hand: [] } })),
      getPhaseCheckpoint: vi.fn(() => ({ phase: 'battle' })),
      play: vi.fn(() => ({ success: true, logs: ['played'] })),
      endTurn: vi.fn(() => ({ success: true, logs: ['ended'] })),
      claimReward: vi.fn(() => ({ success: true, logs: ['claimed'] })),
      skipReward: vi.fn(() => ({ success: true, logs: ['skipped'] })),
      buyShopItem: vi.fn(() => ({ success: true, logs: ['bought'] })),
      leaveShop: vi.fn(() => ({ success: true, logs: ['left'] })),
      getAvailableCommands: vi.fn(() => ['play_card', 'end_turn']),
      can: vi.fn((commandType) => ({
        commandType,
        currentPhase: 'battle',
        requiredPhase: 'battle',
        allowed: commandType === 'play_card' || commandType === 'end_turn',
        reason: commandType === 'play_card' || commandType === 'end_turn' ? null : 'phase_locked',
      })),
      getTurnCheckpoint: vi.fn(() => ({ phase: 'battle', turn: 1 })),
      restoreTurn: vi.fn(() => ({ success: true, logs: ['restored'] })),
      initialLogs: [],
      presenterParams: {
        content: { cards: {}, relics: {}, statuses: {}, enemies: {} },
        lang: 'zh',
        route: null,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies subscribers after init', async () => {
    const mockSession = makeMockSession();
    createSession.mockResolvedValue(mockSession);

    const controller = new SessionController({
      scenario: { id: 'test' },
      presenterFactory: () => ({ buildViewState: () => ({ phase: 'battle', turn: 1, player: { hp: 75 } }) }),
    });
    const onChange = vi.fn();
    controller.subscribe(onChange);

    await controller.init();
    expect(createSession).toHaveBeenCalledWith({ id: 'test' });
    expect(onChange).toHaveBeenCalledWith(controller);
    expect(controller.isReady).toBe(true);
    expect(controller.viewState).toEqual({ phase: 'battle', turn: 1, player: { hp: 75 } });
  });

  it('dispatches play and accumulates logs', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    const session = makeMockSession();
    controller.session = session;

    const result = controller.dispatch('play', { instanceId: 'c1', target: 'e1' });

    expect(session.play).toHaveBeenCalledWith('c1', 'e1');
    expect(result.success).toBe(true);
    expect(controller.logs).toContain('played');
  });

  it('dispatches endTurn', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    const session = makeMockSession();
    controller.session = session;

    const result = controller.dispatch('endTurn');

    expect(session.endTurn).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('dispatches claimReward and skipReward', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    const session = makeMockSession();
    controller.session = session;

    controller.dispatch('claimReward', { key: 'r1' });
    expect(session.claimReward).toHaveBeenCalledWith({ key: 'r1' });

    controller.dispatch('skipReward');
    expect(session.skipReward).toHaveBeenCalled();
  });

  it('dispatches buyShopItem and leaveShop', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    const session = makeMockSession();
    controller.session = session;

    controller.dispatch('buyShopItem', { index: 2 });
    expect(session.buyShopItem).toHaveBeenCalledWith(2);

    controller.dispatch('leaveShop');
    expect(session.leaveShop).toHaveBeenCalled();
  });

  it('returns null for unknown actions', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    controller.session = makeMockSession();

    expect(controller.dispatch('unknown')).toBeNull();
  });

  it('returns null when session is missing', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    expect(controller.dispatch('play', { instanceId: 'c1' })).toBeNull();
  });

  it('accumulates initial logs on init', async () => {
    const mockSession = makeMockSession({
      initialLogs: ['battle start', 'draw'],
    });
    createSession.mockResolvedValue(mockSession);

    const controller = new SessionController({ scenario: { id: 'test' } });
    await controller.init();
    expect(controller.logs).toEqual(['battle start', 'draw']);
  });

  it('notifies subscribers on every dispatch', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    controller.session = makeMockSession();

    const onChange = vi.fn();
    controller.subscribe(onChange);
    controller.dispatch('play', { instanceId: 'c1' });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    controller.session = makeMockSession();

    const onChange = vi.fn();
    controller.subscribe(onChange);
    controller.unsubscribe(onChange);
    controller.dispatch('play', { instanceId: 'c1' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('exposes viewState and phase getters', () => {
    const controller = new SessionController({
      scenario: { id: 'test' },
      presenterFactory: () => ({ buildViewState: () => ({ phase: 'reward', turn: 2 }) }),
    });
    controller.session = makeMockSession();
    controller.presenter = controller.presenterFactory();

    expect(controller.viewState.phase).toBe('reward');
    expect(controller.phase).toBe('reward');
  });

  it('exposes action availability through the session facade', () => {
    const controller = new SessionController({ scenario: { id: 'test' } });
    controller.session = makeMockSession();

    expect(controller.getAvailableActions()).toMatchObject({
      play: true,
      endTurn: true,
      claimReward: false,
      buyShopItem: false,
    });
    expect(controller.can('play')).toMatchObject({
      action: 'play',
      commandType: 'play_card',
      allowed: true,
    });
    expect(controller.can('claimReward')).toMatchObject({
      action: 'claimReward',
      commandType: 'claim_reward',
      allowed: false,
      reason: 'phase_locked',
    });
  });

  describe('timer', () => {
    it('starts timer on init', async () => {
      const controller = new SessionController({ scenario: { id: 'test' } });
      createSession.mockResolvedValue(makeMockSession());
      expect(controller.startTime).toBeNull();

      await controller.init();
      expect(controller.startTime).toBeGreaterThan(0);
      expect(controller.getPlayTime()).toBeGreaterThanOrEqual(0);
    });

    it('formats play time correctly', () => {
      expect(SessionController.formatPlayTime(0)).toBe('0m00s');
      expect(SessionController.formatPlayTime(65000)).toBe('1m05s');
      expect(SessionController.formatPlayTime(3661000)).toBe('1h01m01s');
    });
  });

  describe('multi-slot checkpoints', () => {
    it('lists save slots from the checkpoint store', () => {
      const checkpointStore = {
        list: vi.fn(() => [
          { index: 0, name: '05m30s', playTime: 330000, turn: 3 },
          null,
          { index: 2, name: '12m00s', playTime: 720000, turn: 5 },
        ]),
      };
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore,
      });

      const slots = controller.listSaveSlots();
      expect(slots[0]).toMatchObject({ name: '05m30s', turn: 3 });
      expect(slots[1]).toBeNull();
      expect(slots[2]).toMatchObject({ name: '12m00s', turn: 5 });
    });

    it('saves to a specific slot with play time as name', async () => {
      const checkpointStore = {
        saveSlot: vi.fn(() => true),
      };
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore,
      });
      controller.session = makeMockSession({
        getTurnCheckpoint: vi.fn(() => ({ phase: 'battle', turn: 3 })),
      });
      controller.presenter = { buildViewState: () => ({ phase: 'battle', turn: 3 }) };
      controller.startTime = Date.now() - 330000; // 5m30s ago

      const result = await controller.saveToSlot(1);

      expect(checkpointStore.saveSlot).toHaveBeenCalledWith(1, expect.objectContaining({
        snapshot: { phase: 'battle', turn: 3 },
        turn: 3,
      }));
      expect(result.success).toBe(true);
      expect(result.index).toBe(1);
    });

    it('fails save when no turn checkpoint exists', async () => {
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore: { saveSlot: vi.fn() },
      });
      controller.session = makeMockSession({
        getTurnCheckpoint: vi.fn(() => null),
      });

      const result = await controller.saveToSlot(0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_turn_checkpoint');
    });

    it('loads from a specific slot', async () => {
      const snapshot = {
        phase: 'battle',
        turn: 2,
        battle: {
          entities: { player: { hp: 50 } },
          hand: [],
        },
      };
      const checkpointStore = {
        loadSlot: vi.fn(() => snapshot),
      };
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore,
      });
      controller.session = makeMockSession();

      const result = await controller.loadFromSlot(2);

      expect(checkpointStore.loadSlot).toHaveBeenCalledWith(2);
      expect(controller.session.restoreTurn).toHaveBeenCalledWith(snapshot);
      expect(result.success).toBe(true);
    });

    it('fails load when slot is empty', async () => {
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore: { loadSlot: vi.fn(() => null) },
      });
      controller.session = makeMockSession();

      const result = await controller.loadFromSlot(0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('slot_empty');
    });

    it('fails load when snapshot structure is invalid', async () => {
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore: { loadSlot: vi.fn(() => ({ phase: 'reward' })) },
      });
      controller.session = makeMockSession();

      const result = await controller.loadFromSlot(0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_snapshot');
      expect(controller.session.restoreTurn).not.toHaveBeenCalled();
    });

    it('clears logs on successful undo', () => {
      const controller = new SessionController({ scenario: { id: 'test' } });
      controller.session = makeMockSession({
        restoreTurn: vi.fn(() => ({ success: true, logs: ['restored'] })),
      });
      controller.logs = ['old', 'log'];

      controller.undo();

      expect(controller.logs).toEqual(['restored']);
    });

    it('clears logs on successful load', async () => {
      const snapshot = {
        phase: 'battle',
        battle: {
          entities: { player: { hp: 50 } },
          hand: [],
        },
      };
      const checkpointStore = { loadSlot: vi.fn(() => snapshot) };
      const controller = new SessionController({
        scenario: { id: 'test' },
        checkpointStore,
      });
      controller.session = makeMockSession({
        restoreTurn: vi.fn(() => ({ success: true, logs: ['loaded'] })),
      });
      controller.logs = ['old', 'log'];

      await controller.loadFromSlot(0);

      expect(controller.logs).toEqual(['loaded']);
    });

    it('undo calls restoreTurn without snapshot', () => {
      const controller = new SessionController({ scenario: { id: 'test' } });
      controller.session = makeMockSession();

      const result = controller.undo();

      expect(controller.session.restoreTurn).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });
  });

  describe('debug commands', () => {
    it('routes debug commands through the session', () => {
      const controller = new SessionController({ scenario: { id: 'test' } });
      const session = makeMockSession({
        debugAddGold: vi.fn(() => ({ success: true, logs: ['gold added'] })),
      });
      controller.session = session;

      const result = controller.debugAddGold(50);

      expect(session.debugAddGold).toHaveBeenCalledWith(50);
      expect(result.success).toBe(true);
    });

    it('returns null when debug method is missing', () => {
      const controller = new SessionController({ scenario: { id: 'test' } });
      controller.session = makeMockSession();
      expect(controller.debugWinBattle()).toBeNull();
    });
  });
});
