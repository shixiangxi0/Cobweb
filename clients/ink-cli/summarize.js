/**
 * render/ink-cli/summarize.js — resolution.debug.timeline → 日志行
 *
 * summarizeResolution(resolution, ctx) 直接消费原始 timeline，
 * 为 CLI / 调试视图提供人类可读的渲染层日志语义。
 */
import { buildTimelineGraph } from '../../games/sts/src/shared/timeline.js';
import {
  getPayload,
  sameImpactRef,
  findBridgeChild,
  resolveDamageChain,
  resolveAttackChain,
} from '../shared/timelineChains.js';

function buildDamageLine({ actor = null, target = null, amount = 0, blocked = 0, fatal = false }, ctx) {
  const mods = [];
  if (blocked > 0) mods.push(ctx.log.blocked(blocked));
  return ctx.log.damage(
    ctx.resolveName(actor),
    ctx.resolveName(target),
    amount,
    mods,
    fatal,
  );
}

function buildStatusLine(event, payload, ctx) {
  const statusId = payload.typeId ?? null;
  if (!statusId || statusId === 'block') return null;

  const target = ctx.resolveName(payload.target ?? null);
  const name = ctx.getStatusName(statusId);

  if (event === 'status:remove') {
    return ctx.log.statusRemove(target, name);
  }

  const stacks = payload.stacks ?? 1;
  if (stacks < 0) return ctx.log.statusReduce(target, name, Math.abs(stacks));
  return ctx.log.statusGain(target, name, stacks);
}

/**
 * @param {object} resolution
 * @param {object} ctx presenter.buildCtx() 的返回值
 * @returns {string[]}
 */
export function summarizeResolution(resolution, ctx) {
  const timeline = resolution?.debug?.timeline ?? [];
  const graph = buildTimelineGraph(timeline);
  const lines = [];
  const represented = new Set();

  for (const node of graph.nodes) {
    if (represented.has(node.key)) continue;

    const event = node.entry?.event ?? null;
    const payload = getPayload(node);
    let line = null;

    switch (event) {
      case 'battle:start':
        line = ctx.log.battleStart;
        break;

      case 'player:turn:start':
        line = ctx.log.playerTurnStart;
        break;

      case 'player:turn:end':
        line = ctx.log.playerTurnEnd;
        break;

      case 'actor:turn:start':
        if (payload.target && payload.target !== 'player') {
          line = ctx.log.enemyActStart(ctx.resolveName(payload.target));
        }
        break;

      case 'card:play':
        line = ctx.log.cardPlay(ctx.getCardName(payload.cardId ?? null));
        break;

      case 'card:move':
        line = ctx.log.cardMove(ctx.getCardName(payload.cardId ?? null), payload.from, payload.to);
        break;

      case 'card:system:move':
      case 'card:exhaust':
        // 系统移动和消耗命令本身不显示日志，由 card:move 统一显示
        break;

      case 'entity:attack': {
        const chain = resolveAttackChain(node);
        const attackPayload = getPayload(chain.attackNode);
        const damagePayload = getPayload(chain.damageNode);
        const lossPayload = getPayload(chain.lossNode);
        line = buildDamageLine({
          actor: attackPayload.source ?? null,
          target: attackPayload.target ?? null,
          amount: damagePayload.actualDamage ?? attackPayload.amount ?? 0,
          blocked: damagePayload.blocked ?? 0,
          fatal: !!lossPayload.isFatal || !!chain.dieNode,
        }, ctx);
        represented.add(chain.attackNode?.key);
        represented.add(chain.damageNode?.key);
        represented.add(chain.lossNode?.key);
        represented.add(chain.dieNode?.key);
        break;
      }

      case 'entity:damage': {
        const chain = resolveDamageChain(node);
        const damagePayload = getPayload(chain.damageNode);
        const lossPayload = getPayload(chain.lossNode);
        line = buildDamageLine({
          actor: damagePayload.source ?? null,
          target: damagePayload.target ?? null,
          amount: damagePayload.actualDamage ?? damagePayload.amount ?? 0,
          blocked: damagePayload.blocked ?? 0,
          fatal: !!lossPayload.isFatal || !!chain.dieNode,
        }, ctx);
        represented.add(chain.damageNode?.key);
        represented.add(chain.lossNode?.key);
        represented.add(chain.dieNode?.key);
        break;
      }

      case 'entity:loss':
        if (payload.direct) {
          line = ctx.log.loss(
            ctx.resolveName(payload.source ?? null),
            ctx.resolveName(payload.target ?? null),
            payload.actualLoss ?? payload.amount ?? 0,
          );
        }
        break;

      case 'entity:heal':
        line = ctx.log.heal(ctx.resolveName(payload.target ?? null), payload.amount ?? 0);
        break;

      case 'entity:block':
        if ((payload.amount ?? 0) > 0) {
          line = ctx.log.blockGain(ctx.resolveName(payload.target ?? null), payload.amount ?? 0);
        }
        break;

      case 'status:apply':
      case 'status:remove':
        line = buildStatusLine(event, payload, ctx);
        break;

      case 'enemy:action':
        if (payload.target && payload.action) {
          line = ctx.log.enemyAction(
            ctx.resolveName(payload.target),
            ctx.getEnemyActionDesc(payload.target, payload.action),
          );
        }
        break;

      case 'battle:end':
        line = payload.victory ? ctx.log.battleVictory : ctx.log.battleDefeat;
        break;

      default:
        break;
    }

    if (line != null) lines.push(line);
    represented.add(node.key);


  }

  return lines;
}
