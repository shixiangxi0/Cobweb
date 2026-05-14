/**
 * render/ink-cli/presenter.js — 共享渲染投影层
 *
 * 职责：把引擎原始状态（raw store）转换成 UI/CLI 消费的视图对象。
 * 与引擎解耦：不直接访问 engine，只依赖静态模块元数据和外部传入的原始状态。
 *
 * 导出：
 *   createPresenter({ content, lang, route })
 *     → { buildCtx, buildViewState }
 *   createViewStateBuilder({ content, lang, route })
 *     → { buildViewState }
 *
 * 当前 presenter 只负责两件事：
 *   1. 为 resolution 日志摘要提供名称解析上下文
 *   2. 导出独立的 viewState builder
 *
 * CLI / Phaser 统一消费 content catalog，不再各自拼原始状态解释逻辑。
 */
import { getLocale } from '../shared/locale.js';
import { getBattleEntity } from '../../games/sts/src/shared/battleState.js';
import { localizeContent } from '../shared/content/index.js';
import { createRenderViewStateBuilder } from '../shared/viewStateBuilder.js';

function normalizeContent({ content = null } = {}) {
  return content ?? { cards: {}, relics: {}, statuses: {}, enemies: {} };
}

// ── 日志上下文工厂（可被 session 独立使用，不依赖 createPresenter）────────────

/**
 * @param {object} opts
 * @param {object} [opts.content]        规范化内容目录
 * @param {string} [opts.lang='zh']      显示语言
 */
export function createLogContext({
  content: rawContent = null,
  lang = 'zh',
}) {
  const locale = getLocale(lang);
  const content = localizeContent(normalizeContent({ content: rawContent }), lang);

  function _getSourceName(src, state) {
    if (!src) return locale.unknown;
    if (src === 'player') return locale.player;
    const battleEntity = getBattleEntity(state, src);
    if (battleEntity) {
      const typeId = battleEntity.typeId;
      return content.enemies?.[typeId]?.name ?? typeId ?? src;
    }
    if (content.cards?.[src]?.name) return content.cards[src].name;
    if (content.relics?.[src]?.name) return content.relics[src].name;
    if (content.statuses?.[src]?.name) return content.statuses[src].name;
    return src;
  }

  /**
   * 构建 resolution 日志转换所需的 ctx 对象。
   * @param {() => object} getState  返回引擎当前原始状态的函数
   */
  function buildCtx(getState) {
    return {
      // 统一名称解析：'player'/enemyId/cardId/statusId → 显示名
      resolveName:   (id)             => _getSourceName(id, getState()),
      getStatusName: (id)             => content.statuses?.[id]?.name ?? id,
      getCardName:   (id)             => content.cards?.[id]?.name ?? id,
      // 给定 entity id 和 actionId，返回该行动的 desc（UI 数据）
      getEnemyActionDesc: (entityId, actionId) => {
        const state  = getState();
        const typeId = getBattleEntity(state, entityId)?.typeId;
        return content.enemies?.[typeId]?.actions?.[actionId]?.desc ?? actionId;
      },
      // 日志模板（供 summarize.js 使用）
      log: locale.log,
    };
  }

  return { buildCtx };
}

// ── 工厂：依赖静态模块元数据 ─────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {object} [opts.content]        规范化内容目录
 * @param {string} [opts.lang='zh']      显示语言
 * @param {object} [opts.route]          路线配置
 */
export function createViewStateBuilder({
  content = null,
  lang = 'zh',
  route = null,
}) {
  const normalizedContent = localizeContent(normalizeContent({ content }), lang);
  const builder = createRenderViewStateBuilder({
    content: normalizedContent,
    lang,
    route,
  });

  return {
    content: normalizedContent,
    ...builder,
  };
}

export function createPresenter(opts) {
  const { buildCtx } = createLogContext(opts);
  const { content, buildViewState } = createViewStateBuilder(opts);
  return { content, buildCtx, buildViewState };
}
