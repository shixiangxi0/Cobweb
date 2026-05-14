/**
 * games/sts/src/content/characters/ironclad.js — 铁甲战士角色定义
 *
 * baseStats: 新战斗开始时玩家的初始属性。
 * 存档覆盖字段（如当前 hp）由 initial.player 传入，会覆盖此处默认值。
 */
export const ironclad = {
  id: 'ironclad',
  display: { name: '铁甲战士' },
  baseStats: {
    hp: 75, maxHp: 75,
    energy: 3, maxEnergy: 3,
    drawPerTurn: 5,
  },
};
