import { FlowPhaseScene } from '../shared/FlowPhaseScene.js';
import { COBWEB_SCENE_KEYS } from '../shared/cobwebSceneKeys.js';
import { getLocale, getErrorMessages } from '../../../shared/locale.js';

export class ShopScene extends FlowPhaseScene {
  constructor() {
    super(COBWEB_SCENE_KEYS.shop, 'shop');
  }

  _createPhaseCallbacks() {
    const locale = getLocale(this.host?.getScenario?.()?.lang ?? 'zh');
    return {
      onBuyShopItem: (index) => this.actionDriver?.run?.(
        () => this.host?.getSession?.()?.buyShopItem?.(index),
        {
          failureMessages: getErrorMessages(locale, 'buyShopItem'),
          defaultFailureText: locale.error?.buyShopItem?.default ?? '购买失败。',
        },
      ),
      onLeaveShop: () => this.actionDriver?.run?.(
        () => this.host?.getSession?.()?.leaveShop?.(),
        {
          failureMessages: getErrorMessages(locale, 'leaveShop'),
          defaultFailureText: locale.error?.leaveShop?.default ?? '离开商店失败。',
        },
      ),
    };
  }

  _acceptFlowStep(step) {
    return [
      'shop_buy',
      'shop_leave',
      'relic_acquire',
    ].includes(step?.kind);
  }
}

