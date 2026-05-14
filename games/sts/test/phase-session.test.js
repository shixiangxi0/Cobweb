import { describe, expect, it } from 'vitest';

import { createSession } from '../src/index.js';
import { loadBuiltInScenario } from '../src/content/scenarios/index.js';
import { buildRenderResolution } from '../../../clients/shared/renderStepInterpreter.js';

function loadScenario(name) {
  return loadBuiltInScenario(name);
}

function createTwoFloorScenario({ relics = [] } = {}) {
  return {
    player: { hp: 75, maxHp: 75, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
    deck: [
      'curiosity', 'curiosity', 'curiosity', 'curiosity', 'curiosity',
      'curiosity', 'curiosity', 'curiosity', 'curiosity', 'curiosity',
    ],
    run: {
      relics,
    },
    route: {
      floors: [
        {
          id: 'floor_1',
          battle: {
            enemies: [{ typeId: 'jaw_worm', hp: 42, maxHp: 42 }],
          },
        },
        {
          id: 'floor_2',
          battle: {
            enemies: [{ typeId: 'jaw_worm', hp: 38, maxHp: 38 }],
          },
          afterBattle: [],
        },
      ],
    },
  };
}

function createShopPurchaseScenario() {
  return {
    player: { hp: 75, maxHp: 75, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
    deck: [
      'curiosity', 'curiosity', 'curiosity', 'curiosity', 'curiosity',
      'curiosity', 'curiosity', 'curiosity', 'curiosity', 'curiosity',
    ],
    run: {
      gold: 100,
    },
    route: {
      floors: [
        {
          id: 'shop_floor',
          battle: {
            enemies: [{ typeId: 'jaw_worm', hp: 42, maxHp: 42 }],
          },
          afterBattle: ['shop'],
        },
      ],
    },
  };
}

function createTurnAnimationOrderScenario() {
  return {
    player: { hp: 30, maxHp: 30, energy: 3, maxEnergy: 3, drawPerTurn: 2 },
    deck: ['strike', 'defend', 'bash', 'defend'],
    run: { gold: 0 },
    route: {
      floors: [
        {
          id: 'turn_order_floor',
          battle: {
            enemies: [{ typeId: 'jaw_worm', hp: 42, maxHp: 42 }],
          },
          afterBattle: [],
        },
      ],
    },
  };
}

function toLegacyArrayTable(values = []) {
  return Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
}

describe('sts-headless phase orchestration', () => {
  function renderResolution(result) {
    return buildRenderResolution(result?.resolution ?? null);
  }

  it('does not expose obsolete manual reward or shop entry commands', async () => {
    const session = await createSession(loadScenario('starter'));

    expect(session.generateReward).toBeUndefined();
    expect(session.enterShop).toBeUndefined();
  });

  it('uses declared phase rules to gate commands and clear battle turn checkpoints', async () => {
    const session = await createSession(loadScenario('starter'));

    expect(session.getStateSnapshot().phase).toBe('battle');
    expect(session.getStateSnapshot().battle.afterBattle).toEqual(['reward', 'shop']);
    expect(session.getTurnCheckpoint()).not.toBeNull();
    expect(session.getAvailableCommands()).toEqual(['play_card', 'end_turn', 'discard_card']);
    expect(session.can('play_card')).toMatchObject({
      commandType: 'play_card',
      currentPhase: 'battle',
      requiredPhase: 'battle',
      allowed: true,
      reason: null,
    });

    const reward = session.debugOpenReward();
    expect(reward.success).toBe(true);
    expect(session.getStateSnapshot().phase).toBe('reward');
    expect(session.getStateSnapshot().reward.afterReward).toEqual(['shop']);
    expect(session.getTurnCheckpoint()).toBeNull();
    expect(session.getAvailableCommands()).toEqual(['claim_reward', 'skip_reward']);
    expect(session.can('play_card')).toMatchObject({
      commandType: 'play_card',
      currentPhase: 'reward',
      requiredPhase: 'battle',
      allowed: false,
      reason: 'phase_locked',
    });

    const blockedPlay = session.play('curiosity_1');
    expect(blockedPlay.success).toBe(false);
    expect(blockedPlay.reason).toBe('phase_locked');

    const blockedDiscard = session.discard('curiosity_1');
    expect(blockedDiscard.success).toBe(false);
    expect(blockedDiscard.reason).toBe('phase_locked');

    const skipped = session.skipReward();
    expect(skipped.success).toBe(true);
    expect(session.getStateSnapshot().phase).toBe('shop');
    expect(session.getStateSnapshot().shop.afterShop ?? []).toEqual([]);
    expect(session.getPhaseCheckpoint().phase).toBe('shop');
    expect(session.getAvailableCommands()).toEqual(['buy_shop_item', 'leave_shop']);

    const blockedEndTurn = session.endTurn();
    expect(blockedEndTurn.success).toBe(false);
    expect(blockedEndTurn.reason).toBe('phase_locked');
  });

  it('captures and restores phase checkpoints across shop transitions', async () => {
    const session = await createSession(createTwoFloorScenario());

    const opened = session.debugOpenShop();
    expect(opened.success).toBe(true);
    expect(session.getStateSnapshot().phase).toBe('shop');

    const shopCheckpoint = session.getPhaseCheckpoint();
    expect(shopCheckpoint.phase).toBe('shop');
    expect(session.getTurnCheckpoint()).toBeNull();

    const left = session.leaveShop();
    expect(left.success).toBe(true);
    expect(session.getStateSnapshot().phase).toBe('battle');
    expect(session.getStateSnapshot().run.progress.completed).toBe(false);

    const restored = session.restorePhase(shopCheckpoint);
    expect(restored.success).toBe(true);
    expect(session.getStateSnapshot().phase).toBe('shop');
    expect(session.getTurnCheckpoint()).toBeNull();
  });

  it('leaves shop into the next battle floor and replays battle enter lifecycle', async () => {
    const session = await createSession(createTwoFloorScenario());

    const opened = session.debugOpenShop();
    expect(opened.success).toBe(true);
    expect(session.getStateSnapshot().phase).toBe('shop');

    const left = session.leaveShop();
    expect(left.success).toBe(true);

    const state = session.getStateSnapshot();
    expect(state.phase).toBe('battle');
    expect(state.shop).toBeNull();
    expect(state.run.progress.floorIndex).toBe(1);
    expect(state.battle.hand.length).toBeGreaterThan(0);
    expect(state.battle.turn).toBeGreaterThan(0);
    expect(session.getTurnCheckpoint()).not.toBeNull();
  });

  it('restores starting relic bindings from the serialized store before opening shop', async () => {
    const session = await createSession(createTwoFloorScenario({
      relics: ['merchant_badge'],
    }));

    const opened = session.debugOpenShop();
    expect(opened.success).toBe(true);

    const shop = session.getStateSnapshot().shop;
    expect(shop?.pricing?.discountMultiplier).toBe(0.9);
    expect(shop?.benefits?.freePurchase?.remainingUses).toBe(1);
    expect(shop?.benefits?.freePurchase?.maxBasePrice).toBe(50);
  });

  it('keeps shop purchases phase-local until shop phase leave commits them', async () => {
    const session = await createSession(createShopPurchaseScenario());

    const opened = session.debugOpenShop();
    expect(opened.success).toBe(true);

    const bought = session.buyShopItem(0);
    expect(bought.success).toBe(true);

    const inShop = session.getStateSnapshot();
    expect(inShop.phase).toBe('shop');
    expect(inShop.run.gold).toBe(100);
    expect(inShop.shop.gold).toBe(55);

    const purchasedCard = inShop.shop.purchases.cards[0];
    expect(purchasedCard).toBeTruthy();
    expect(inShop.run.deck.some((entry) => entry.cardId === purchasedCard)).toBe(false);
    expect(session.getStateSnapshot().shop.gold).toBe(55);

    const left = session.leaveShop();
    expect(left.success).toBe(true);

    const committed = session.getStateSnapshot();
    expect(committed.run.gold).toBe(55);
    expect(committed.run.deck.some((entry) => entry.cardId === purchasedCard)).toBe(true);
    expect(committed.shop == null).toBe(true);
  });

  it('emits internal end-turn discard steps before next-turn draw steps', async () => {
    const session = await createSession(createTurnAnimationOrderScenario());

    const result = session.endTurn();
    expect(result.success).toBe(true);
    const resolution = renderResolution(result);

    const firstDiscardIndex = resolution.steps.findIndex(
      (step) => step.kind === 'card_moved' && step.data?.from === 'hand' && step.data?.to === 'discardPile',
    );
    const firstDrawIndex = resolution.steps.findIndex(
      (step) => step.kind === 'card_moved' && step.data?.from === 'drawPile' && step.data?.to === 'hand',
    );

    expect(firstDiscardIndex).toBeGreaterThanOrEqual(0);
    expect(firstDrawIndex).toBeGreaterThanOrEqual(0);
    expect(firstDiscardIndex).toBeLessThan(firstDrawIndex);
    expect(resolution.steps.some((step) => step.kind === 'card_discarded')).toBe(false);
    expect(resolution.steps.some((step) => step.kind === 'card_drawn')).toBe(false);
  });

  it('normalizes legacy object-shaped battle zone lists when restoring snapshots', async () => {
    const session = await createSession(loadScenario('starter'));
    const legacySnapshot = session.getStateSnapshot();

    legacySnapshot.battle.hand = toLegacyArrayTable(legacySnapshot.battle.hand);
    legacySnapshot.battle.drawPile = toLegacyArrayTable(legacySnapshot.battle.drawPile);
    legacySnapshot.battle.discardPile = toLegacyArrayTable(legacySnapshot.battle.discardPile);
    legacySnapshot.battle.exhaustPile = toLegacyArrayTable(legacySnapshot.battle.exhaustPile);

    const restored = await createSession(loadScenario('starter'), {
      snapshot: legacySnapshot,
    });

    const rawState = restored.getStateSnapshot();
    expect(Array.isArray(rawState.battle.hand)).toBe(true);
    expect(Array.isArray(rawState.battle.drawPile)).toBe(true);

    expect(Array.isArray(rawState.battle.hand)).toBe(true);
    expect(rawState.battle.hand.length).toBeGreaterThan(0);

    const played = restored.play(rawState.battle.hand[0], rawState.battle.enemies['1']);
    expect(played.success).toBe(true);
  });
});
