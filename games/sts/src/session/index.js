/**
 * games/sts/src/session/index.js — 游戏会话
 *
 * createSession(scenario) 返回 session 对象：
 *   play(instanceId, target?)  → { resolution }
 *   endTurn()                  → { resolution }
 *   getStateSnapshot()         → 当前完整引擎状态（可用于重建 session）
 *   getPhaseCheckpoint()       → 当前 phase 起点的引擎状态
 *   getTurnCheckpoint()        → 当前 battle turn 起点的引擎状态
 *   restorePhase(snapshot?)    → 恢复到当前 phase 起点
 *   restoreTurn(snapshot?)     → 恢复到回合起点
 *   debugAddGold(amount?)      → 调试：直接增减金币
 *   debugWinBattle()           → 调试：将敌人置 0 并触发胜利结算
 *   debugOpenReward()          → 调试：触发胜利后直接打开奖励
 *   debugOpenShop()            → 调试：触发胜利后直接进入商店
 *
 * checkpoint 语义：
 *   phaseCheckpoint = 当前 phase 进入完成后的稳定状态
 *   turnCheckpoint  = 当前 battle 中最近一次 player:turn:start 完成后的稳定状态
 *   currentState     = 当前最新 live state（不是 checkpoint）
 */
import { createEngine } from '../../../../packages/core/src/Engine.js';
import { createStsLifecycleHooks } from '../bindings/lifecycle.js';
import { stsModule }        from '../module.js';

import { loadModules }      from '../content/loader.js';
import {
  coerceBattleZoneList,
  getBattleCard,
  getBattleEntity,
  getBattleHand,
  getBattleRuntime,
  listBattleEnemyIds,
} from '../shared/battleState.js';

import {
  isBattleActive,
  isRewardPhase,
  isShopPhase,
  resolveGamePhase,
} from '../state/phase.js';
import {
  PHASE_COMMAND_REASONS,
  PHASE_MACHINE,
  getPhaseCommands,
  getPhaseCheckpoints,
} from '../state/phase.js';
import {
  normalizeScenarioRoute,
  buildRouteProgress,
  resolveRouteFloor,
} from './route.js';
import { buildBattleStore, buildRunState } from './builder.js';
import { buildStsResolution } from './resolution.js';


function getCommandRequirement(commandType) {
  for (const [phase, config] of Object.entries(PHASE_MACHINE)) {
    if (config.commands.includes(commandType)) {
      return { phase, reason: PHASE_COMMAND_REASONS[commandType] ?? 'phase_locked' };
    }
  }
  return null;
}

function resolveScopedCommandTypes(state = {}) {
  return getPhaseCommands(resolveGamePhase(state));
}

/**
 * @param {object} scenario  来自共享 scenario 数据源或外部导入对象
 * @param {object} [options]
 * @param {object|null} [options.snapshot]         用于重建 session 的当前最新状态
 * @param {object|null} [options.phaseCheckpoint]  当前 phase 起点快照；未提供时回退到 snapshot
 * @param {object|null} [options.turnCheckpoint]   当前 battle turn 起点快照；未提供时 battle phase 回退到 snapshot
 * @param {number|null} [options.seed]             新开局时使用的确定性随机种子；未提供时回退到 scenario.seed
 * @returns {Promise<object>} session
 */
export async function createSession(scenario, options = {}) {
  const {
    snapshot = null,
    phaseCheckpoint: initialPhaseCheckpoint = null,
    turnCheckpoint: initialTurnCheckpoint = null,
    seed: explicitSeed = null,
  } = options;
  const {
    cards,
    character,
    enemyDefs,
    relicDefs,
    content,
  } = loadModules();
  const route = normalizeScenarioRoute(scenario);

  const pendingBundles = [];

  const { preFire, afterFire } = createStsLifecycleHooks()
  const engine = await createEngine({
    onBundle: (bundle) => {
      pendingBundles.push(bundle);
    },
    preFire,
    afterFire,
  });

  engine.use(stsModule);

  // 注入内容池（由 loadModules 返回的完整卡牌/遗物池）
  const pools = {
    cards: Object.entries(cards)
      .filter(([id, def]) => def && !def.starting)
      .map(([id, def]) => ({ id, rarity: def.rarity ?? 'common' })),
    relics: Object.entries(relicDefs)
      .map(([id, def]) => ({ id, shopPrice: def.shopPrice ?? 150 })),
  };

  const defaultRngSeed = explicitSeed ?? scenario.seed ?? Date.now();

  engine.use({
    inject: {
      Pools: pools,
      ScenarioSeed: defaultRngSeed,
    },
  });

  function cloneSnapshot(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function drainBundles() {
    return pendingBundles.splice(0);
  }

  function buildResolution(command, bundles = []) {
    return buildStsResolution({ command, bundles });
  }

  function emitCommand(event, payload = {}) {
    return { result: engine.state.emit(event, payload), bundles: drainBundles() };
  }

  function runRootEvent(command, event, payload = {}) {
    const { result, bundles } = emitCommand(event, payload);
    return { result, bundles, resolution: buildResolution(command, bundles) };
  }


  function normalizeBattleScope(snapshot) {
    if (!snapshot?.battle || Array.isArray(snapshot.battle)) return snapshot;
    const nextBattle = {
      ...snapshot.battle,
      drawPile: coerceBattleZoneList(snapshot.battle.drawPile),
      hand: coerceBattleZoneList(snapshot.battle.hand),
      discardPile: coerceBattleZoneList(snapshot.battle.discardPile),
      exhaustPile: coerceBattleZoneList(snapshot.battle.exhaustPile),
    };
    return { ...snapshot, battle: nextBattle };
  }

  function normalizeSnapshot(snapshot) {
    if (!snapshot || Array.isArray(snapshot)) {
      return { phase: 'battle' };
    }
    const nextSnapshot = normalizeBattleScope(cloneSnapshot(snapshot));
    nextSnapshot.phase = resolveGamePhase(nextSnapshot);
    delete nextSnapshot.scene;
    if (nextSnapshot.run?.player) {
      nextSnapshot.run.player = { ...nextSnapshot.run.player };
      delete nextSnapshot.run.player.statuses;
      delete nextSnapshot.run.player.energy;
    }
    if (nextSnapshot.battle) {
      if (nextSnapshot.battle.turn == null) {
        nextSnapshot.battle.turn = 0;
      }
      if (!nextSnapshot.battle.entities?.player) {
        nextSnapshot.battle.entities ??= {};
        nextSnapshot.battle.entities.player ??= {};
      }
    }
    return nextSnapshot;
  }

  function loadSnapshot(snapshotValue) {
    const normalizedSnapshot = normalizeSnapshot(snapshotValue);
    engine.load(normalizedSnapshot);
    pendingBundles.length = 0;
    return cloneSnapshot(engine.getState());
  }

  function enterBattlePhase({ bundles = [], state = engine.getState() } = {}) {
    const progress = state?.run?.progress;
    const floorIndex = progress?.floorIndex ?? 0;
    const floorCount = progress?.floorCount ?? 0;

    if (progress?.completed || floorIndex >= floorCount) {
      setPhaseCheckpoint(engine.getState());
      setTurnCheckpoint(null);
      return { success: true, bundles: [...bundles, ...drainBundles()] };
    }

    const floor = resolveRouteFloor(route, state?.run?.progress ?? buildRouteProgress(route, 0));
    const runState = cloneSnapshot(state?.run ?? {});
    const store = buildBattleStore({
      initial: {
        player: floor?.battle?.player ?? {},
        enemies: Object.fromEntries((floor?.battle?.enemies ?? []).filter(e => e?.typeId).map((e, i) => [String(i + 1), { typeId: e.typeId, hp: e.hp, maxHp: e.maxHp ?? e.hp }])),
        deck: floor?.battle?.deck ?? runState.deck,
      },
      run: runState,
      cards,
      character,
    });
    const battleSnapshot = {
      ...store,
      battle: {
        ...store.battle,
        afterBattle: Array.isArray(floor?.afterBattle) ? cloneSnapshot(floor.afterBattle) : [],
      },
      meta: cloneSnapshot(state?.meta ?? {}),
    };
    engine.load({ ...battleSnapshot, phase: null });
    engine.state.emit('battle:start', {});
    const phase = resolveGamePhase(engine.getState());
    const checkpoints = getPhaseCheckpoints(phase);
    if (checkpoints.phaseCheckpoint === 'capture') setPhaseCheckpoint(engine.getState());
    else if (checkpoints.phaseCheckpoint === 'clear') setPhaseCheckpoint(null);
    if (checkpoints.turnCheckpoint === 'capture') setTurnCheckpoint(engine.getState());
    else if (checkpoints.turnCheckpoint === 'clear') setTurnCheckpoint(null);
    return { success: true, bundles: [...bundles, ...drainBundles()] };
  }

  function settleAfterEvents(bundles = []) {
    if (bundles.some(b => (b?.timeline ?? []).some(e => e?.event === 'flow:advance'))) {
      return enterBattlePhase({ bundles });
    }
    const phase = resolveGamePhase(engine.getState());
    const checkpoints = getPhaseCheckpoints(phase);
    if (checkpoints.phaseCheckpoint === 'capture') setPhaseCheckpoint(engine.getState());
    else if (checkpoints.phaseCheckpoint === 'clear') setPhaseCheckpoint(null);
    if (checkpoints.turnCheckpoint === 'capture') setTurnCheckpoint(engine.getState());
    else if (checkpoints.turnCheckpoint === 'clear') setTurnCheckpoint(null);
    return { success: true, bundles: [...bundles, ...drainBundles()] };
  }

  function bootstrapNewSession() {
    const run = buildRunState({ scenario, character, progress: buildRouteProgress(route, 0) });
    const state = { run };
    pendingBundles.length = 0;
    const entered = enterBattlePhase({ state });
    return { bundles: entered.bundles, snapshot: cloneSnapshot(engine.getState()) };
  }

  function runDebugVictoryFlow() {
    if (!isBattleActive(engine.getState())) {
      engine.state.emit('phase:enter', { phase: 'battle' });
    }
    const enemyIds = listBattleEnemyIds(engine.getState());
    if (enemyIds.length === 0) {
      const result = engine.state.emit('battle:end', { victory: true });
      return { result, bundles: drainBundles() };
    }
    for (const entityId of enemyIds) {
      engine.state.set('battle', 'entities', entityId, 'hp', 0);
      engine.state.emit('entity:die', { target: entityId });
    }
    return { result: { cancelled: false }, bundles: drainBundles() };
  }

  const checkpoints = new Map();
  const PHASE_CHECKPOINT = 'phase';
  const TURN_CHECKPOINT = 'turn';

  function setPhaseCheckpoint(snapshotValue = engine.getState()) {
    if (snapshotValue == null) { checkpoints.delete(PHASE_CHECKPOINT); return null; }
    checkpoints.set(PHASE_CHECKPOINT, cloneSnapshot(normalizeSnapshot(snapshotValue)));
    return checkpoints.get(PHASE_CHECKPOINT);
  }

  function setTurnCheckpoint(snapshotValue = null) {
    if (snapshotValue == null) { checkpoints.delete(TURN_CHECKPOINT); return null; }
    checkpoints.set(TURN_CHECKPOINT, cloneSnapshot(normalizeSnapshot(snapshotValue)));
    return checkpoints.get(TURN_CHECKPOINT);
  }

  function getPhaseCheckpoint() {
    const snapshot = checkpoints.get(PHASE_CHECKPOINT);
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  function getTurnCheckpoint() {
    const snapshot = checkpoints.get(TURN_CHECKPOINT);
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  function stageTransaction(result) {
    if (!result?.success) return result;
    return { ...result, committed: true };
  }

  function resolveCommandCapability(commandType, state = engine.getState()) {
    const requirement = getCommandRequirement(commandType);
    const phase = resolveGamePhase(state);
    if (!requirement) {
      return {
        commandType,
        currentPhase: phase,
        requiredPhase: null,
        allowed: false,
        reason: 'unknown_command',
      };
    }
    return {
      commandType,
      currentPhase: phase,
      requiredPhase: requirement.phase,
      allowed: phase === requirement.phase,
      reason: phase === requirement.phase ? null : (requirement.reason ?? 'phase_locked'),
    };
  }

  function rejectPhase(command) {
    const capability = resolveCommandCapability(command?.type);
    if (capability.allowed) return null;
    if (capability.reason === 'unknown_command') return null;
    return {
      success: false,
      reason: capability.reason ?? 'phase_locked',
      logs: [],
      resolution: buildResolution(command),
    };
  }

  function buildPhaseTransitionResponse(command, transition, { logs = false } = {}) {
    const resolution = buildResolution(command, transition.bundles);
    return stageTransaction({
      success: transition.success,
      ...(!transition.success && { reason: transition.reason ?? 'cancelled' }),
      ...(logs && { logs: [] }),
      resolution,
    });
  }

  let initialBundles = [];
  let initialCommandType = 'session_start';

  if (snapshot) {
    const normalizedSnapshot = loadSnapshot(snapshot);
    setPhaseCheckpoint(initialPhaseCheckpoint ?? normalizedSnapshot);
    if (initialTurnCheckpoint != null) {
      setTurnCheckpoint(initialTurnCheckpoint);
    } else if (isBattleActive(normalizedSnapshot)) {
      setTurnCheckpoint(normalizedSnapshot);
    } else {
      setTurnCheckpoint(null);
    }
    initialCommandType = 'session_resume';
  } else {
    const bootstrap = bootstrapNewSession();
    setPhaseCheckpoint(engine.getState());
    setTurnCheckpoint(engine.getState());
    initialBundles = bootstrap.bundles;
  }

  const initialResolution = buildResolution(
    { type: initialCommandType },
    initialBundles,
  );
  return {
    initialLogs: [],
    initialResolution,

    getAvailableCommands(state = engine.getState()) {
      return [...resolveScopedCommandTypes(state)];
    },

    can(commandType, state = engine.getState()) {
      return resolveCommandCapability(commandType, state);
    },

    play(instanceId, target = null) {
      const command = { type: 'play_card', instanceId, target };
      const blocked = rejectPhase(command);
      if (blocked) return blocked;

      const state = engine.getState();
      if (!isBattleActive(state))
        return {
          success: false,
          reason: 'battle_over',
          logs: [],
          resolution: buildResolution(command),
        };
      if (!getBattleHand(state).includes(instanceId))
        return {
          success: false,
          reason: 'not_in_hand',
          logs: [],
          resolution: buildResolution(command),
        };

      const card = getBattleCard(state, instanceId);
      if (!card) {
        return {
          success: false,
          reason: 'card_not_found',
          logs: [],
          resolution: buildResolution(command),
        };
      }
      const targetType = card.targetType;
      if (targetType === 'enemy' && !target) {
        return {
          success: false,
          reason: 'target_required',
          logs: [],
          resolution: buildResolution(command),
        };
      }
      const enemyIds = listBattleEnemyIds(state);
      if (targetType === 'enemy' && !enemyIds.includes(target)) {
        return {
          success: false,
          reason: 'invalid_target',
          logs: [],
          resolution: buildResolution(command),
        };
      }
      const entity = getBattleEntity(state, target);
      if (targetType === 'enemy' && (!entity || (entity.hp ?? 0) <= 0)) {
        return {
          success: false,
          reason: 'target_dead',
          logs: [],
          resolution: buildResolution(command),
        };
      }

      const { result, bundles, resolution } = runRootEvent({
        ...command,
        cardId: card.cardId,
        cost: card.cost,
      }, 'card:play', {
        instanceId,
        cardId: card.cardId,
        target,
        cost:   card.cost,
      });

      if (result.cancelled)
        return { success: false, reason: 'cancelled', logs: [], resolution };

      const settled = settleAfterEvents(bundles);
      const runtime = getBattleRuntime(engine.getState());
      const finalResolution = settled.bundles === bundles
        ? resolution
        : buildResolution({
          ...command,
          cardId: runtime.cards?.[instanceId]?.cardId,
          cost: runtime.cards?.[instanceId]?.cost,
        }, settled.bundles);

      if (!settled.success) {
        return {
          success: false,
          reason: settled.reason ?? 'cancelled',
          logs: [],
          resolution: finalResolution,
        };
      }

      return stageTransaction({
        success: true,
        logs: [],
        resolution: finalResolution,
      });
    },

    discard(instanceId) {
      const command = { type: 'discard_card', instanceId };
      const blocked = rejectPhase(command);
      if (blocked) return blocked;

      const state = engine.getState();
      if (!getBattleHand(state).includes(instanceId))
        return {
          success: false,
          reason: 'not_in_hand',
          logs: [],
          resolution: buildResolution(command),
        };

      const card = getBattleCard(state, instanceId);
      const { result, bundles } = runRootEvent(command, 'card:discard', {
        instanceId,
        cardId: card?.cardId,
        reason: 'player_choice',
      });
      const resolution = buildResolution(command, bundles);

      if (result.cancelled)
        return { success: false, reason: 'cancelled', logs: [], resolution };

      const settled = settleAfterEvents(bundles);
      const finalResolution = settled.bundles === bundles
        ? resolution
        : buildResolution(command, settled.bundles);

      if (!settled.success) {
        return {
          success: false,
          reason: settled.reason ?? 'cancelled',
          logs: [],
          resolution: finalResolution,
        };
      }

      return stageTransaction({
        success: true,
        logs: [],
        resolution: finalResolution,
      });
    },

    endTurn() {
      const command = { type: 'end_turn' };
      const blocked = rejectPhase(command);
      if (blocked) return blocked;

      let bundles = [];
      let resolution = buildResolution(command);
      if (isBattleActive(engine.getState())) {
        ({ bundles, resolution } = runRootEvent(command, 'turn:end', {}));
        const baseBundles = bundles;
        const settled = settleAfterEvents(bundles);
        bundles = settled.bundles;
        resolution = settled.bundles === baseBundles
          ? resolution
          : buildResolution(command, settled.bundles);
      }
      return stageTransaction({
        success: true,
        logs: [],
        resolution,
      });
    },

    // 返回当前完整状态快照，用于像新对局一样重建 session
    getStateSnapshot() { return cloneSnapshot(engine.getState()); },

    getPhaseCheckpoint,

    getTurnCheckpoint,

    restorePhase(snapshot = getPhaseCheckpoint()) {
      if (!snapshot) {
        return {
          success: false,
          reason: 'no_phase_checkpoint',
          logs: [],
          resolution: buildResolution({ type: 'restore_phase' }),
        };
      }

      const nextSnapshot = loadSnapshot(snapshot);
      setPhaseCheckpoint(nextSnapshot);
      if (isBattleActive(nextSnapshot)) {
        setTurnCheckpoint(nextSnapshot);
      } else {
        setTurnCheckpoint(null);
      }
      return {
        success: true,
        logs: [],
        resolution: buildResolution({ type: 'restore_phase' }),
      };
    },

    // 恢复到指定 snapshot（默认：当前回合起点）
    // 传入外部存档 JSON 时可用于跨会话读档
    restoreTurn(snapshot = getTurnCheckpoint()) {
      if (!snapshot) {
        return {
          success: false,
          reason: 'no_turn_checkpoint',
          logs: [],
          resolution: buildResolution({ type: 'restore_turn' }),
        };
      }

      const nextSnapshot = loadSnapshot(snapshot);
      const currentPhaseCheckpoint = getPhaseCheckpoint();
      if (!currentPhaseCheckpoint || resolveGamePhase(nextSnapshot) !== resolveGamePhase(currentPhaseCheckpoint)) {
        setPhaseCheckpoint(nextSnapshot);
      }
      setTurnCheckpoint(nextSnapshot);
      return {
        success: true,
        logs: [],
        resolution: buildResolution({ type: 'restore_turn' }),
      };
    },
    // ── 调试辅助 ─────────────────────────────────────────────
    debugAddGold(amount = 100) {
      const numeric = Number(amount);
      const delta = Number.isFinite(numeric) ? Math.trunc(numeric) : 100;
      const gold = engine.state.get('run', 'gold') || 0;
      engine.state.set('run', 'gold', Math.max(0, gold + delta));
      return stageTransaction({
        success: true,
        logs: [],
        resolution: buildResolution({ type: 'debug_add_gold', amount: delta }),
      });
    },

    debugWinBattle() {
      const result = runDebugVictoryFlow();
      const settled = result.result.cancelled
        ? { success: false, reason: result.result.reason ?? 'cancelled', bundles: result.bundles }
        : settleAfterEvents(result.bundles);
      const resolution = buildResolution({ type: 'debug_win_battle' }, settled.bundles);
      return stageTransaction({
        success: !result.result.cancelled && settled.success,
        ...((result.result.cancelled || !settled.success) && { reason: result.result.reason ?? settled.reason ?? 'cancelled' }),
        logs: [],
        resolution,
      });
    },

    debugOpenReward() {
      const command = { type: 'debug_open_reward' };
      const state = engine.getState();
      if (isRewardPhase(state)) {
        return stageTransaction({
          success: true,
          logs: [],
          resolution: buildResolution(command),
        }, getPhaseCheckpoints(resolveGamePhase(state)));
      }

      const victory = runDebugVictoryFlow();
      if (victory.result.cancelled) {
        return {
          success: false,
          reason: victory.result.reason ?? 'cancelled',
          logs: [],
          resolution: buildResolution(command, victory.bundles),
          };
      }

      return buildPhaseTransitionResponse(command, settleAfterEvents(victory.bundles), { logs: true });
    },

    debugOpenShop() {
      const command = { type: 'debug_open_shop' };
      const state = engine.getState();
      if (isShopPhase(state)) {
        return stageTransaction({
          success: true,
          logs: [],
          resolution: buildResolution(command),
        }, getPhaseCheckpoints(resolveGamePhase(state)));
      }
      if (isRewardPhase(state)) {
        const skip = emitCommand('reward:skip', {});
        if (skip.result.cancelled) {
          return {
            success: false,
            reason: skip.result.reason ?? 'cancelled',
            logs: [],
            resolution: buildResolution(command, skip.bundles),
          };
        }
        return buildPhaseTransitionResponse(command, settleAfterEvents(skip.bundles), { logs: true });
      }

      const victory = runDebugVictoryFlow();
      if (victory.result.cancelled) {
        return {
          success: false,
          reason: victory.result.reason ?? 'cancelled',
          logs: [],
          resolution: buildResolution(command, victory.bundles),
        };
      }

      const opened = settleAfterEvents(victory.bundles);
      if (!opened.success) {
        return {
          success: false,
          reason: opened.reason ?? 'cancelled',
          logs: [],
          resolution: buildResolution(command, opened.bundles),
        };
      }
      if (!isRewardPhase(engine.getState())) {
        return buildPhaseTransitionResponse(command, opened, { logs: true });
      }

      const skip = emitCommand('reward:skip', {});
      const nextBundles = [...opened.bundles, ...skip.bundles];
      if (skip.result.cancelled) {
        return {
          success: false,
          reason: skip.result.reason ?? 'cancelled',
          logs: [],
          resolution: buildResolution(command, nextBundles),
        };
      }
      return buildPhaseTransitionResponse(command, settleAfterEvents(nextBundles), { logs: true });
    },

    claimReward(choice = {}) {
      const claimCommand = {
        type: 'claim_reward',
        choiceKey: choice?.key ?? null,
      };
      const blocked = rejectPhase(claimCommand);
      if (blocked) return blocked;

      const claim = emitCommand('reward:claim', {
        key: choice?.key ?? null,
      });

      if (claim.result.cancelled) {
        return {
          success: false,
          reason: claim.result.reason ?? 'cancelled',
          resolution: buildResolution(claimCommand, claim.bundles),
        };
      }

      return buildPhaseTransitionResponse(
        claimCommand,
        settleAfterEvents(claim.bundles),
      );
    },

    skipReward() {
      const skipCommand = { type: 'skip_reward' };
      const blocked = rejectPhase(skipCommand);
      if (blocked) return blocked;

      const skip = emitCommand('reward:skip', {});

      if (skip.result.cancelled) {
        return {
          success: false,
          reason: skip.result.reason ?? 'cancelled',
          resolution: buildResolution(skipCommand, skip.bundles),
        };
      }

      return buildPhaseTransitionResponse(
        skipCommand,
        settleAfterEvents(skip.bundles),
      );
    },

    buyShopItem(index) {
      const command = { type: 'buy_shop_item', index };
      const blocked = rejectPhase(command);
      if (blocked) return blocked;

      const { result, resolution } = runRootEvent(
        command,
        'shop:buy',
        { index: index + 1 },
      );

      if (result.cancelled) {
        return {
          success: false,
          reason: result.reason ?? 'cancelled',
          resolution,
        };
      }

      return stageTransaction({ success: true, resolution });
    },

    leaveShop() {
      const leaveCommand = { type: 'leave_shop' };
      const blocked = rejectPhase(leaveCommand);
      if (blocked) return blocked;

      const shopLeave = emitCommand('shop:leave', {});
      if (shopLeave.result.cancelled) {
        return {
          success: false,
          reason: shopLeave.result.reason ?? 'cancelled',
          resolution: buildResolution(leaveCommand, shopLeave.bundles),
        };
      }

      return buildPhaseTransitionResponse(
        leaveCommand,
        settleAfterEvents(shopLeave.bundles),
      );
    },

    content,

    presenterParams: {
      content,
      lang: scenario.lang ?? 'zh',
      route,
    },
  };
}
