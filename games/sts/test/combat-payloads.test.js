import { describe, expect, it } from 'vitest';

import { createEngine } from '../../../packages/core/src/Engine.js';
import { buildBattleStore } from '../src/session/builder.js';
import { stsModule } from '../src/module.js';
import { buildStsResolution } from '../src/session/resolution.js';
import { createStsLifecycleHooks } from '../src/bindings/lifecycle.js';
import { buildRenderResolution } from '../../../clients/shared/renderStepInterpreter.js';

function createBattleStore() {
  return buildBattleStore({
    initial: {
      player: { hp: 70, maxHp: 70, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
      enemies: {
        1: { typeId: 'jaw_worm', hp: 40, maxHp: 40 },
      },
      deck: [],
    },
    run: {
      gold: 0,
      relics: [],
      potions: [],
      deck: [],
      player: { hp: 70, maxHp: 70, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
    },
  });
}

function drainBundles(queue) {
  const bundles = queue.slice();
  queue.length = 0;
  return bundles;
}

describe('sts-headless combat payloads', () => {
  it('keeps attack/loss payloads focused on their own semantic layer', async () => {
    const bundles = [];
    const { preFire, afterFire } = createStsLifecycleHooks();
    const engine = await createEngine({
      onBundle: (bundle) => bundles.push(bundle),
      preFire,
      afterFire,
    });

    engine.use(stsModule);
    engine.load(createBattleStore());

    engine.state.emit('status:apply', { target: 'player', typeId: 'weak', stacks: 1 });
    engine.state.emit('status:apply', { target: 'jaw_worm_1', typeId: 'block', stacks: 3 });
    drainBundles(bundles);

    engine.state.emit('entity:attack', {
      target: 'jaw_worm_1',
      amount: 8,
      source: 'player',
      action: 'test_attack',
    });

    const resolution = buildStsResolution({
      command: { type: 'test_attack' },
      bundles: drainBundles(bundles),
    });
    const renderResolution = buildRenderResolution(resolution);

    const attackStep = renderResolution.steps.find((step) => step.kind === 'attack');
    expect(attackStep).toBeTruthy();
    expect(attackStep.data).not.toHaveProperty('weakReduced');
    expect(attackStep.data.blocked).toBe(3);
    expect(attackStep.data.actualDamage).toBe(3);
    expect(attackStep.data.actualLoss).toBe(3);

    const attackEvent = resolution.debug.timeline.find((entry) => entry.event === 'entity:attack');
    expect(attackEvent.payload).not.toHaveProperty('weakReduced');

    const lossEvent = resolution.debug.timeline.find((entry) => entry.event === 'entity:loss');
    expect(lossEvent.payload).not.toHaveProperty('blocked');
    expect(lossEvent.payload).not.toHaveProperty('actualDamage');
    expect(lossEvent.payload).not.toHaveProperty('weakReduced');
    expect(lossEvent.payload.actualLoss).toBe(3);
    expect(lossEvent.payload.isFatal).toBe(false);
  });

  it('annotates derived resolution steps with their logic-side action sequence', async () => {
    const bundles = [];
    const { preFire, afterFire } = createStsLifecycleHooks();
    const engine = await createEngine({
      onBundle: (bundle) => bundles.push(bundle),
      preFire,
      afterFire,
    });

    engine.use(stsModule);
    engine.load(buildBattleStore({
      initial: {
        player: { hp: 70, maxHp: 70, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
        enemies: {
          1: { typeId: 'jaw_worm', hp: 40, maxHp: 40 },
        },
        deck: ['bash', 'defend'],
      },
      run: {
        gold: 0,
        relics: [],
        potions: [],
        deck: [
          { cardId: 'bash', upgrades: 0 },
          { cardId: 'defend', upgrades: 0 },
        ],
        player: { hp: 70, maxHp: 70, energy: 3, maxEnergy: 3, drawPerTurn: 5 },
      },
    }));

    // 测试跳过了 battle:start → 抽牌 → card:move 的正常流程，
    // 手动绑定卡牌以确保 card:effect 路由正确（D1 后引擎不再临时绑定）
    engine.state.bind({ key: 'bash_1', kind: 'card', id: 'bash', ctx: { iid: 'bash_1', cardId: 'bash', action: 'bash' } });

    engine.state.emit('card:play', {
      instanceId: 'bash_1',
      cardId: 'bash',
      target: 'jaw_worm_1',
      cost: 2,
    });

    const resolution = buildStsResolution({
      command: { type: 'play_card' },
      bundles: drainBundles(bundles),
    });
    const renderResolution = buildRenderResolution(resolution);

    const playStep = renderResolution.steps.find((step) => step.kind === 'play_card');
    const attackStep = renderResolution.steps.find((step) => step.kind === 'attack');
    const statusStep = renderResolution.steps.find((step) => step.kind === 'apply_status');

    expect(playStep?.refs.sequenceKind).toBe('play_card');
    expect(playStep?.refs.sequenceId).toBeTruthy();
    expect(attackStep?.refs.sequenceId).toBe(playStep?.refs.sequenceId);
    expect(attackStep?.refs.sequenceKind).toBe('play_card');
    expect(statusStep?.refs.sequenceId).toBe(playStep?.refs.sequenceId);
    expect(statusStep?.refs.sequenceKind).toBe('play_card');
  });
});
