/**
 * games/sts/src/content/loader.js — 聚合所有模块，构建 createEngine 所需的 defs 对象
 *
 * 返回：
 *   - gameplay defs：cards / relicDefs / enemyDefs / character
 *   - canonical content：content.{ cards, relics, statuses, enemies }
 *
 * 注意：这里只构建统一内容原语，不做 i18n overlay。
 * 语言覆盖属于渲染层职责，由 render/shared/ 在展示阶段应用。
 */
import { ALL_STATUS_MODULES } from './statuses/core.js';
import { stsModule }          from '../module.js';
import { ironclad }           from './characters/ironclad.js';
import { createContentCatalog } from '../shared/content/catalog.js';

export function loadModules() {
  const allEnemies = { ...stsModule.defs.enemy };
  const cards      = { ...stsModule.defs.card };
  const relicDefs  = { ...stsModule.defs.relic };
  const content = createContentCatalog({
    cards,
    relicDefs,
    statusModules: ALL_STATUS_MODULES,
    enemyDefs: allEnemies,
  });

  return {
    cards,
    character: ironclad,
    enemyDefs: allEnemies,
    relicDefs,
    content,
  };
}
