export const COBWEB_SCENE_KEYS = {
  battle: 'CobwebBattleScene',
  reward: 'CobwebRewardScene',
  shop: 'CobwebShopScene',
};

export function sceneKeyForViewState(viewState = null) {
  const phase = viewState?.phase ?? 'battle';
  if (phase === 'reward') return COBWEB_SCENE_KEYS.reward;
  if (phase === 'shop') return COBWEB_SCENE_KEYS.shop;
  return COBWEB_SCENE_KEYS.battle;
}

