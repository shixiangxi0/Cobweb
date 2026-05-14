import { describe, expect, it } from 'vitest';

import { createRenderViewStateBuilder } from '../viewStateBuilder.js';

describe('createRenderViewStateBuilder', () => {
  it('builds reward/shop/battle view states through the phaser-side adapter', () => {
    const builder = createRenderViewStateBuilder({
      content: {
        cards: {
          strike: {
            id: 'strike',
            name: 'Strike',
            desc: 'Deal 6 damage.',
            type: 'attack',
            cost: 1,
            rarity: null,
            targetType: 'enemy',
            exhaust: false,
            display: { name: 'Strike', desc: 'Deal 6 damage.', type: 'attack' },
          },
        },
        relics: {
          anchor: {
            id: 'anchor',
            name: 'Anchor',
            desc: 'Start each combat with 10 Block.',
            rarity: 'rare',
            shopPrice: null,
            display: { name: 'Anchor', desc: 'Start each combat with 10 Block.' },
          },
        },
        statuses: {
          weak: {
            id: 'weak',
            name: 'Weak',
            desc: 'Deal {stacks} less damage.',
            display: { name: 'Weak', desc: 'Deal {stacks} less damage.' },
          },
        },
        enemies: {
          slime: {
            id: 'slime',
            name: 'Slime',
            display: { name: 'Slime' },
            actions: { attack: { id: 'attack', type: 'attack', desc: 'Deal 5 damage.' } },
          },
        },
      },
      lang: 'en',
      route: { id: 'r1', name: 'Test Route', floors: [{ id: 'f1', label: 'Floor 1' }] },
    });

    expect(builder.buildViewState({
      phase: 'battle',
      run: { gold: 12, relics: ['anchor'], progress: { floorIndex: 0 } },
      battle: {
        turn: 2,
        hand: ['c1'],
        drawPile: ['c2'],
        discardPile: [],
        exhaustPile: [],
        enemies: { 1: 'e1' },
        entities: {
          player: { hp: 70, maxHp: 70, energy: 3, maxEnergy: 3, statuses: {} },
          e1: { typeId: 'slime', hp: 18, maxHp: 18, statuses: { weak: { stacks: 2 } }, intent: 'attack' },
        },
        cards: {
          c1: { cardId: 'strike', cost: 1 },
        },
      },
    })).toMatchObject({
      phase: 'battle',
      turn: 2,
      hand: [{ instanceId: 'c1', cardId: 'strike' }],
      enemies: [{ entityId: 'e1', name: 'Slime', intentDesc: 'Deal 5 damage.' }],
      run: { gold: 12, relicEntries: [{ id: 'anchor', name: 'Anchor' }] },
    });

    expect(builder.buildViewState({
      phase: 'reward',
      run: { gold: 12, progress: { floorIndex: 0 } },
      reward: {
        entries: [
          { key: 'gold', kind: 'gold', amount: 25 },
          { key: 'relic:anchor', kind: 'relic', relicId: 'anchor' },
        ],
      },
      battle: {},
    })).toMatchObject({
      phase: 'reward',
      reward: {
        entries: [
          { kind: 'gold', amount: 25 },
          { kind: 'relic', relicId: 'anchor', name: 'Anchor' },
        ],
      },
    });

    expect(builder.buildViewState({
      phase: 'shop',
      run: { gold: 88, progress: { floorIndex: 0 } },
      shop: {
        gold: 88,
        stock: [
          { type: 'card', id: 'strike', basePrice: 50, price: 50, discountedPrice: 50, canAfford: true },
          { type: 'relic', id: 'anchor', basePrice: 150, price: 120, discountedPrice: 120, canAfford: true },
        ],
      },
      battle: {},
    })).toMatchObject({
      phase: 'shop',
      shop: {
        gold: 88,
        shelves: [
          { key: 'cards', items: [{ id: 'strike', price: 50, rarity: null }] },
          { key: 'relics', items: [{ id: 'anchor', price: 120, rarity: 'rare' }] },
        ],
      },
    });
  });
});
