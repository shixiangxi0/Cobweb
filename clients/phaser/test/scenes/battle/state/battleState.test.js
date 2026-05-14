import { describe, expect, it } from 'vitest';

import { applyBattleRenderPatch } from '../../../../scenes/battle/state/battleState.js';

function createBattleState(overrides = {}) {
  return {
    turn: 1,
    player: {
      hp: 70,
      maxHp: 70,
      energy: 3,
      maxEnergy: 3,
      block: 0,
      statuses: {},
    },
    enemies: [],
    hand: [{ instanceId: 'card_1', cardId: 'strike', cost: 1 }],
    piles: { draw: 2, discard: 0, exhaust: 0 },
    over: false,
    victory: false,
    ...overrides,
  };
}

describe('applyBattleRenderPatch', () => {
  it('patches internal draw and discard steps like visible zone steps', () => {
    const stageState = createBattleState();
    const viewState = createBattleState({
      hand: [{ instanceId: 'card_2', cardId: 'defend', cost: 1 }],
      piles: { draw: 1, discard: 1, exhaust: 0 },
    });

    applyBattleRenderPatch(stageState, {
      kind: 'card_moved',
      refs: { instanceId: 'card_1', cardId: 'strike' },
      data: { from: 'hand', to: 'discardPile' },
    }, viewState);

    expect(stageState.hand).toEqual([]);
    expect(stageState.piles.discard).toBe(1);

    applyBattleRenderPatch(stageState, {
      kind: 'card_moved',
      refs: { instanceId: 'card_2', cardId: 'defend' },
      data: { from: 'drawPile', to: 'hand' },
    }, viewState);

    expect(stageState.piles.draw).toBe(1);
    expect(stageState.hand).toEqual([{ instanceId: 'card_2', cardId: 'defend', cost: 1 }]);
  });

  it('patches created cards that move directly into hand', () => {
    const stageState = createBattleState({
      hand: [{ instanceId: 'mirror_image_1', cardId: 'mirror_image', cost: 2 }],
      piles: { draw: 2, discard: 0, exhaust: 0 },
    });
    const viewState = createBattleState({
      hand: [
        { instanceId: 'strike_999999', cardId: 'strike', cost: 1 },
      ],
      piles: { draw: 2, discard: 1, exhaust: 0 },
    });

    applyBattleRenderPatch(stageState, {
      kind: 'play_card',
      refs: { instanceId: 'mirror_image_1', cardId: 'mirror_image' },
      data: { cost: 2 },
    }, viewState);

    applyBattleRenderPatch(stageState, {
      kind: 'card_moved',
      refs: { instanceId: 'strike_999999', cardId: 'strike' },
      data: { to: 'hand' },
    }, viewState);

    expect(stageState.hand).toEqual([
      { instanceId: 'strike_999999', cardId: 'strike', cost: 1 },
    ]);
  });

  it('patches created cards that move directly into piles', () => {
    const stageState = createBattleState({
      hand: [],
      piles: { draw: 2, discard: 0, exhaust: 0 },
    });
    const viewState = createBattleState({
      hand: [],
      piles: { draw: 3, discard: 1, exhaust: 1 },
    });

    applyBattleRenderPatch(stageState, {
      kind: 'card_moved',
      refs: { instanceId: 'time_echo_999999', cardId: 'time_echo' },
      data: { to: 'drawPile' },
    }, viewState);

    applyBattleRenderPatch(stageState, {
      kind: 'card_moved',
      refs: { instanceId: 'anger_999999', cardId: 'anger' },
      data: { to: 'discardPile' },
    }, viewState);

    applyBattleRenderPatch(stageState, {
      kind: 'card_moved',
      refs: { instanceId: 'burn_999999', cardId: 'burn' },
      data: { to: 'exhaustPile' },
    }, viewState);

    expect(stageState.piles).toEqual({ draw: 3, discard: 1, exhaust: 1 });
  });
});
