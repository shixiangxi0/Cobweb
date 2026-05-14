import { FlowPhaseScene } from '../shared/FlowPhaseScene.js';
import { COBWEB_SCENE_KEYS } from '../shared/cobwebSceneKeys.js';
import { getLocale, getErrorMessages } from '../../../shared/locale.js';

export class RewardScene extends FlowPhaseScene {
  constructor() {
    super(COBWEB_SCENE_KEYS.reward, 'reward');
  }

  _createPhaseCallbacks() {
    const locale = getLocale(this.host?.getScenario?.()?.lang ?? 'zh');
    return {
      onClaimReward: (choice) => this.actionDriver?.run?.(
        () => this.host?.getSession?.()?.claimReward?.(choice),
        {
          failureMessages: getErrorMessages(locale, 'claimReward'),
          defaultFailureText: locale.error?.claimReward?.default ?? '领取奖励失败。',
        },
      ),
      onSkipReward: () => this.actionDriver?.run?.(
        () => this.host?.getSession?.()?.skipReward?.(),
        {
          failureMessages: getErrorMessages(locale, 'skipReward'),
          defaultFailureText: locale.error?.skipReward?.default ?? '跳过奖励失败。',
        },
      ),
    };
  }

  _acceptFlowStep(step) {
    return [
      'reward_claim',
      'reward_skip',
      'relic_acquire',
    ].includes(step?.kind);
  }
}

