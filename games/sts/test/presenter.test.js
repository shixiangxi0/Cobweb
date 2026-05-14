import { describe, expect, it } from 'vitest';

import { createPresenter } from '../../../clients/ink-cli/presenter.js';

function createTestPresenter() {
  return createPresenter({
    content: {
      cards: {
        strike_plus: {
          id: 'strike_plus',
          name: 'Strike+',
          desc: 'Deal 9 damage.',
          type: 'attack',
          cost: 1,
          rarity: 'common',
          targetType: 'none',
          exhaust: false,
          display: {
            name: 'Strike+',
            desc: 'Deal 9 damage.',
            type: 'attack',
          },
        },
      },
      relics: {
        lantern: {
          id: 'lantern',
          name: 'Lantern',
          desc: 'Gain 1 energy on turn 1.',
          rarity: 'common',
          shopPrice: null,
          display: {
            name: 'Lantern',
            desc: 'Gain 1 energy on turn 1.',
          },
        },
      },
      statuses: {},
      enemies: {},
    },
    lang: 'en',
  });
}

describe('presenter buildViewState', () => {
  it('emits reward view state as shell plus reward payload only', () => {
    const presenter = createTestPresenter();

    const viewState = presenter.buildViewState({
      phase: 'reward',
      battle: {
        over: true,
        victory: true,
      },
      run: {
        gold: 42,
        relics: ['lantern'],
        progress: {
          routeId: 'starter',
          routeName: 'Starter Route',
          floorIndex: 0,
          floorCount: 1,
          floorId: 'floor_1',
          floorLabel: 'Floor 1',
          completed: false,
        },
      },
      reward: {
        entries: [{ key: 'gold:0', kind: 'gold', amount: 12 }],
      },
    });

    expect(viewState).toMatchObject({
      phase: 'reward',
      over: true,
      victory: true,
      rewardOffered: true,
      run: {
        gold: 42,
        relicEntries: [{ id: 'lantern', name: 'Lantern' }],
      },
      reward: {
        entries: [{ key: 'gold:0', kind: 'gold', amount: 12 }],
      },
    });
    expect(viewState.player).toBeUndefined();
    expect(viewState.enemies).toBeUndefined();
    expect(viewState.hand).toBeUndefined();
    expect(viewState.piles).toBeUndefined();
    expect(viewState.turn).toBeUndefined();
    expect(viewState.statusGroups).toBeUndefined();
  });

  it('emits shop view state as shell plus shop payload only', () => {
    const presenter = createTestPresenter();

    const viewState = presenter.buildViewState({
      phase: 'shop',
      battle: {
        over: true,
        victory: true,
      },
      run: {
        gold: 80,
        relics: [],
        progress: {
          routeId: 'starter',
          routeName: 'Starter Route',
          floorIndex: 0,
          floorCount: 1,
          floorId: 'floor_1',
          floorLabel: 'Floor 1',
          completed: false,
        },
      },
      shop: {
        gold: 80,
        stock: [{
          type: 'card',
          id: 'strike_plus',
          basePrice: 90,
          price: 75,
          discountedPrice: 75,
          canAfford: true,
        }],
      },
    });

    expect(viewState).toMatchObject({
      phase: 'shop',
      over: true,
      victory: true,
      rewardOffered: false,
      run: {
        gold: 80,
      },
      shop: {
        shelves: [{
          key: 'cards',
          items: [{ id: 'strike_plus', price: 75, name: 'Strike+' }],
        }],
      },
    });
    expect(viewState.player).toBeUndefined();
    expect(viewState.enemies).toBeUndefined();
    expect(viewState.hand).toBeUndefined();
    expect(viewState.piles).toBeUndefined();
    expect(viewState.turn).toBeUndefined();
    expect(viewState.statusGroups).toBeUndefined();
  });
});
