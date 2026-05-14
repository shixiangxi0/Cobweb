/**
 * render/shared/locale.js — Bilingual text definitions (zh / en)
 *
 * Contains four categories of strings:
 *   presenter  — Entity name fallback (used by presenter.js)
 *   log        — Battle log templates (used by summarize.js)
 *   ui         — UI text (used by App.jsx)
 *   cli        — CLI prompts (used by cli.js)
 *
 * Usage:
 *   import { getLocale } from './locale.js';
 *   const L = getLocale('en'); // or 'zh' (default is 'en')
 */

const LOCALES = {
  // ── 中文 ──────────────────────────────────────────────────────────────
  zh: {
    // 实体名称回退
    unknown:       '未知',
    player:        '玩家',
    enemyFallback: (slot) => `敌人${slot}`,

    // 战斗日志模板
    log: {
      damage: (src, tgt, net, mods, fatal) => {
        let line = `${src} 对 ${tgt} 造成 ${net} 点伤害`;
        if (mods.length)  line += `（${mods.join('，')}）`;
        if (fatal)        line += '，击败！';
        return line;
      },
      blocked:      (n)        => `格挡 ${n} 点`,
      blockGain:    (tgt, n)   => `  └ ${tgt} 获得 ${n} 点格挡`,
      statusGain:   (tgt, name, n) => `  └ ${tgt} 获得 ${n} 层${name}`,
      statusReduce: (tgt, name, n) => `  └ ${tgt} 的${name}减少 ${n} 层`,
      statusRemove: (tgt, name)    => `  └ ${tgt} 的${name}消除`,
      cardPlay:     (name)     => `▷ 出牌：${name}`,
      cardExhaust:  (name)     => `  └ 消耗：${name}`,
      cardMove:     (name, from, to) => {
        if (from === 'drawPile' && to === 'hand') return `  └ 抽牌：${name}`;
        if (to === 'discardPile') return `  └ 弃牌：${name}`;
        if (to === 'exhaustPile') return `  └ 消耗：${name}`;
        return `  └ 移动：${name}`;
      },
      playerTurnStart: '─── 玩家回合开始 ───',
      playerTurnEnd:   '─── 玩家回合结束 ───',
      enemyActStart:     (name)       => `▶ ${name} 行动开始`,
      enemyAction:       (name, desc) => `  └ ${name} 使用 ${desc}`,
      cardDraw:          (name)       => `  └ 抽牌：${name}`,
      loss:    (src, tgt, n)   => `${src} 令 ${tgt} 直接失去 ${n} 点 HP`,
      die:     (tgt)           => `☠ ${tgt} 被击败！`,
      heal:    (tgt, n)        => `  └ ${tgt} 恢复 ${n} 点 HP`,
      battleStart:   '─── 战斗开始 ───',
      battleVictory: '─── 战斗胜利！───',
      battleDefeat:  '─── 战斗失败。───',
    },

    // UI 界面文字
    ui: {
      title:      '== 杀戮尖塔 ==',
      chromeTitle:'Cobweb CLI',
      shellTitle: 'STS 参考战斗',
      player:     '玩家',
      hp:         'HP',
      energy:     '能量',
      block:      '格挡',
      // 卡牌类型标签（手牌列表每行左侧缩写）
      cardType:   { attack: '攻击', skill: '技能', power: '能力' },
      // 敌人意图图标
      intentIcon: { attack: '[攻]', defend: '[防]', buff: '[增益]', debuff: '[减益]' },
      // 牌堆标签
      pileLabels: { draw: '抽牌', discard: '弃牌', exhaust: '消耗' },
      handCount:  (n) => `手牌（${n}张）`,
      exhaust:    '[消耗]',
      turn:       (n) => `第 ${n} 回合`,
      loading:    '正在初始化 Lua 引擎...',
      victory:    '== 战斗胜利！==',
      defeat:     '== 你被击败了。==',
      pressQuit:  '按 q 退出',
      mode: {
        battle: '战斗中',
        target: '目标选择',
        dict:   '词典展开',
        discard: '弃牌模式',
      },
      section: {
        battlefield: '战场',
        hand:        '出牌区',
        controls:    '操作',
        notice:      '提示',
      },
      empty: {
        log:  '等待新的事件...',
        hand: '当前没有手牌',
      },
      dictTitle:  '状态词典（当前生效）',
      dictEmpty:  '无生效状态',
      dictClose:  '按 [i] 关闭',
      logTitle:   '战斗日志',
      reward: {
        title: '战斗奖励',
        empty: '当前没有可领取的奖励',
        skip: '跳过奖励',
        claim: '领取奖励',
        hintChoose: '按数字领取奖励',
        hintSkip: '按 [s] 跳过',
        goldName: '金币',
        goldDesc: (n) => `获得 ${n} 金币，可在后续商店直接消费。`,
        goldBadge: (n) => `+${n} 金`,
        runTitleFallback: '深渊试炼',
      },
      shop: {
        title: '商店',
        empty: '当前没有可购买的商品',
        leave: '离开商店',
        hintBuy: '按数字购买商品',
        hintLeave: '按 [e] 离开商店',
        shelfCardsTitle: '卡牌货架',
        shelfCardsSubtitle: '战技与技巧',
        shelfRelicsTitle: '遗物展台',
        shelfRelicsSubtitle: '稀有陈列',
        priceFree: '免费',
        priceGold: (n) => `${n} 金`,
        priceOriginal: (n) => `原 ${n} 金`,
        priceDiscounted: (n) => `折后 ${n} 金`,
        noticeFreeOffer: '当前有一件低价商品可免费购买。',
      },
      hint: {
        play:         '出牌',
        end:          '回合结束',
        undo:         '撤销',
        save:         '存档',
        load:         '读档',
        dict:         '状态词典',
        quit:         '退出',
        closeDict:    '关闭状态词典',
        selectTarget: '选目标敌人编号',
        selectTargetCard: (name) => `为 ${name} 选择目标敌人编号`,
        selectSlot:   '选择槽位',
        cancel:       '取消',
        discard:      '弃掉手牌',
        discardMode:  '进入弃牌模式',
      },
      menu: {
        saveTitle:  '选择存档位置',
        loadTitle:  '选择读档位置',
        emptySlot:  '空槽位',
      },
      notice: {
        saved:    (n) => `💾 存档成功（第 ${n} 回合起点）`,
        saveFail: (e) => `存档失败：${e}`,
        loaded:   '📂 读档成功',
        loadFail: '读档失败：找不到存档或文件损坏',
        undone:    '↩ 已恢复到本回合起点',
        undoFail:  '撤销失败：没有可恢复的回合起点',
        battleOnly: '此功能仅在战斗阶段可用',
        playFailed: '出牌失败',
      },
    },

    // CLI 提示（cli.js）
    cli: {
      title:             '== 杀戮尖塔 ==',
      selectScene:       '选择场景：',
      sceneNotFound:     (name, list) => `\n找不到场景"${name}"。\n可用场景：${list}\n`,
      jsonUsage:         '用法: node render/ink-cli/cli.js json <场景名>',
      jsonSceneNotFound: (name)       => `找不到场景: ${name}`,
      invalidJson:       '输入必须是合法 JSON',
      unknownCmd:        (cmd)        => `未知命令: ${cmd}，支持: play / end / state / claim / skip / buy / leave / quit`,
      playNeedId:        'play 需要 instanceId 字段',
      initFail:          (e)          => `引擎初始化失败: ${e}`,
    },

    // 错误原因翻译（游戏层返回机器 reason，渲染层通过 getErrorMessage 获取人话）
    error: {
      play: {
        phase_locked: '当前阶段无法出牌。',
        render_pending: '演出尚未完成，请稍后再试。',
        battle_over: '战斗已结束。',
        not_in_hand: '此牌已不在手牌中。',
        card_not_found: '找不到该卡牌。',
        target_required: '请选择目标。',
        invalid_target: '无效目标。',
        target_dead: '目标已死亡。',
        cancelled: '出牌被取消。',
        default: '出牌失败。',
      },
      endTurn: {
        phase_locked: '当前阶段无法结束回合。',
        render_pending: '演出尚未完成，请稍后再试。',
        default: '无法结束回合。',
      },
      claimReward: {
        phase_locked: '当前没有可领取的奖励。',
        not_in_reward: '当前没有可领取的奖励。',
        no_reward: '当前没有可领取的奖励。',
        invalid_choice: '这一份奖励拿不走。',
        cancelled: '奖励领取失败。',
        default: '领取奖励失败。',
      },
      skipReward: {
        phase_locked: '当前没有可略过的奖励。',
        not_in_reward: '当前没有可略过的奖励。',
        no_reward: '当前没有可略过的奖励。',
        cancelled: '奖励略过失败。',
        default: '跳过奖励失败。',
      },
      buyShopItem: {
        phase_locked: '当前不在商店中。',
        not_in_shop: '当前不在商店中。',
        not_found: '这件货物已经不在货架上了。',
        insufficient_gold: '金币不够。',
        already_owned: '这件遗物已经拥有了。',
        invalid_item: '这件货物当前无法购买。',
        cancelled: '购买失败。',
        default: '购买失败。',
      },
      leaveShop: {
        phase_locked: '当前不在商店中。',
        not_in_shop: '当前不在商店中。',
        cancelled: '暂时无法离开商店。',
        default: '离开商店失败。',
      },
      ackRender: {
        no_pending_transaction: '没有待确认的事务。',
        default: '确认失败。',
      },
      restoreCommitted: {
        no_committed_snapshot: '没有已提交的快照。',
        default: '恢复失败。',
      },
      restorePhase: {
        no_phase_checkpoint: '没有阶段检查点。',
        default: '恢复阶段失败。',
      },
      restoreTurn: {
        no_turn_checkpoint: '没有回合检查点。',
        default: '恢复回合失败。',
      },
    },
  },

  // ── English ────────────────────────────────────────────────────────────
  en: {
    unknown:       'unknown',
    player:        'Player',
    enemyFallback: (slot) => `Enemy ${slot}`,

    log: {
      damage: (src, tgt, net, mods, fatal) => {
        let line = `${src} deals ${net} damage to ${tgt}`;
        if (mods.length)  line += ` (${mods.join(', ')})`;
        if (fatal)        line += ', defeated!';
        return line;
      },
      blocked:      (n)        => `blocked ${n}`,
      blockGain:    (tgt, n)   => `  └ ${tgt} gains ${n} block`,
      statusGain:   (tgt, name, n) => `  └ ${tgt} gains ${n} ${name}`,
      statusReduce: (tgt, name, n) => `  └ ${tgt}'s ${name} -${n}`,
      statusRemove: (tgt, name)    => `  └ ${tgt}'s ${name} removed`,
      cardPlay:     (name)     => `▷ Play: ${name}`,
      cardExhaust:  (name)     => `  └ Exhaust: ${name}`,
      cardMove:     (name, from, to) => {
        if (from === 'drawPile' && to === 'hand') return `  └ Draw: ${name}`;
        if (to === 'discardPile') return `  └ Discard: ${name}`;
        if (to === 'exhaustPile') return `  └ Exhaust: ${name}`;
        return `  └ Move: ${name}`;
      },
      playerTurnStart: '─── Player Turn Start ───',
      playerTurnEnd:   '─── Player Turn End ───',
      enemyActStart:     (name)       => `▶ ${name} acts`,
      enemyAction:       (name, desc) => `  └ ${name} uses ${desc}`,
      cardDraw:          (name)       => `  └ Draw: ${name}`,
      loss:    (src, tgt, n)   => `${src} causes ${tgt} to lose ${n} HP directly`,
      die:     (tgt)           => `☠ ${tgt} defeated!`,
      heal:    (tgt, n)        => `  └ ${tgt} heals ${n} HP`,
      battleStart:   '─── Battle Start ───',
      battleVictory: '─── Victory! ───',
      battleDefeat:  '─── Defeat. ───',
    },

    ui: {
      title:      '== Cobweb ==',
      chromeTitle:'Cobweb CLI',
      shellTitle: 'STS Reference Battle',
      player:     'Player',
      hp:         'HP',
      energy:     'Energy',
      block:      'Block',
      cardType:   { attack: 'ATK', skill: 'SKL', power: 'PWR' },
      intentIcon: { attack: '[ATK]', defend: '[DEF]', buff: '[BUFF]', debuff: '[DEB]' },
      pileLabels: { draw: 'Draw', discard: 'Disc', exhaust: 'Exh' },
      handCount:  (n) => `Hand (${n})`,
      exhaust:    '[Exhaust]',
      turn:       (n) => `Turn ${n}`,
      loading:    'Initializing Lua engine...',
      victory:    '== Victory! ==',
      defeat:     '== Defeated. ==',
      pressQuit:  'Press q to quit',
      mode: {
        battle: 'Battle',
        target: 'Targeting',
        dict:   'Dictionary',
        discard: 'Discard Mode',
      },
      section: {
        battlefield: 'Battlefield',
        hand:        'Action Panel',
        controls:    'Controls',
        notice:      'Notice',
      },
      empty: {
        log:  'Awaiting new events...',
        hand: 'No cards in hand',
      },
      dictTitle:  'Status Dictionary (Active)',
      dictEmpty:  'No active statuses',
      dictClose:  'Press [i] to close',
      logTitle:   'Battle Log',
      reward: {
        title: 'Battle Rewards',
        empty: 'No reward is currently available',
        skip: 'Skip Reward',
        claim: 'Claim Reward',
        hintChoose: 'Press a number to claim a reward',
        hintSkip: 'Press [s] to skip',
        goldName: 'Gold',
        goldDesc: (n) => `Gain ${n} gold, spendable in future shops.`,
        goldBadge: (n) => `+${n} G`,
        runTitleFallback: 'Abyss Trial',
      },
      shop: {
        title: 'Shop',
        empty: 'No shop item is currently available',
        leave: 'Leave Shop',
        hintBuy: 'Press a number to buy an item',
        hintLeave: 'Press [e] to leave',
        shelfCardsTitle: 'Card Shelf',
        shelfCardsSubtitle: 'Skills & Techniques',
        shelfRelicsTitle: 'Relic Display',
        shelfRelicsSubtitle: 'Rare Collection',
        priceFree: 'Free',
        priceGold: (n) => `${n} Gold`,
        priceOriginal: (n) => `Orig. ${n} Gold`,
        priceDiscounted: (n) => `Disc. ${n} Gold`,
        noticeFreeOffer: 'A low-priced item is available for free.',
      },
      hint: {
        play:         'Play',
        end:          'End Turn',
        undo:         'Undo',
        save:         'Save',
        load:         'Load',
        dict:         'Status Dict',
        quit:         'Quit',
        closeDict:    'Close Status Dict',
        selectTarget: 'Select enemy slot #',
        selectTargetCard: (name) => `Select enemy slot for ${name}`,
        selectSlot:   'Select slot',
        cancel:       'Cancel',
        discard:      'Discard card',
        discardMode:  'Enter discard mode',
      },
      menu: {
        saveTitle:  'Select Save Slot',
        loadTitle:  'Select Load Slot',
        emptySlot:  'Empty slot',
      },
      notice: {
        saved:    (n) => `💾 Saved (Turn ${n} checkpoint)`,
        saveFail: (e) => `Save failed: ${e}`,
        loaded:   '📂 Load successful',
        loadFail: 'Load failed: no save file or corrupted data',
        undone:    '↩ Restored to turn start',
        undoFail:  'Undo failed: no turn checkpoint available',
        battleOnly: 'This feature is only available during battle',
        playFailed: 'Play failed',
      },
    },

    cli: {
      title:             '== Cobweb ==',
      selectScene:       'Select scenario:',
      sceneNotFound:     (name, list) => `\nScenario "${name}" not found.\nAvailable: ${list}\n`,
      jsonUsage:         'Usage: node render/ink-cli/cli.js json <scenario>',
      jsonSceneNotFound: (name)       => `Scenario not found: ${name}`,
      invalidJson:       'Input must be valid JSON',
      unknownCmd:        (cmd)        => `Unknown command: ${cmd}. Supported: play / end / state / claim / skip / buy / leave / quit`,
      playNeedId:        'play requires instanceId field',
      initFail:          (e)          => `Engine init failed: ${e}`,
    },

    error: {
      play: {
        phase_locked: 'Cannot play cards in this phase.',
        render_pending: 'Animation in progress, please wait.',
        battle_over: 'The battle is over.',
        not_in_hand: 'This card is no longer in hand.',
        card_not_found: 'Card not found.',
        target_required: 'Please select a target.',
        invalid_target: 'Invalid target.',
        target_dead: 'The target is already dead.',
        cancelled: 'Play cancelled.',
        default: 'Play failed.',
      },
      endTurn: {
        phase_locked: 'Cannot end turn in this phase.',
        render_pending: 'Animation in progress, please wait.',
        default: 'Cannot end turn.',
      },
      claimReward: {
        phase_locked: 'No reward available.',
        not_in_reward: 'No reward available.',
        no_reward: 'No reward available.',
        invalid_choice: 'Invalid reward choice.',
        cancelled: 'Failed to claim reward.',
        default: 'Failed to claim reward.',
      },
      skipReward: {
        phase_locked: 'No reward to skip.',
        not_in_reward: 'No reward to skip.',
        no_reward: 'No reward to skip.',
        cancelled: 'Failed to skip reward.',
        default: 'Failed to skip reward.',
      },
      buyShopItem: {
        phase_locked: 'Not in a shop.',
        not_in_shop: 'Not in a shop.',
        not_found: 'Item no longer in stock.',
        insufficient_gold: 'Not enough gold.',
        already_owned: 'You already own this relic.',
        invalid_item: 'This item cannot be purchased.',
        cancelled: 'Purchase failed.',
        default: 'Purchase failed.',
      },
      leaveShop: {
        phase_locked: 'Not in a shop.',
        not_in_shop: 'Not in a shop.',
        cancelled: 'Cannot leave shop right now.',
        default: 'Failed to leave shop.',
      },
      ackRender: {
        no_pending_transaction: 'No pending transaction.',
        default: 'Acknowledgement failed.',
      },
      restoreCommitted: {
        no_committed_snapshot: 'No committed snapshot.',
        default: 'Restore failed.',
      },
      restorePhase: {
        no_phase_checkpoint: 'No phase checkpoint.',
        default: 'Restore phase failed.',
      },
      restoreTurn: {
        no_turn_checkpoint: 'No turn checkpoint.',
        default: 'Restore turn failed.',
      },
    },
  },
};

/**
 * @param {'zh'|'en'} [lang='en']
 * @returns {typeof LOCALES.zh}
 */
export function getLocale(lang = 'en') {
  return LOCALES[lang] ?? LOCALES.en;
}

/**
 * 获取指定 action + reason 的错误消息。
 * @param {ReturnType<getLocale>} locale
 * @param {string} action   e.g. 'play', 'endTurn', 'buyShopItem'
 * @param {string} reason   e.g. 'not_in_hand', 'cancelled'
 * @returns {string}
 */
export function getErrorMessage(locale, action, reason) {
  const table = locale.error?.[action];
  if (!table) return reason;
  return table[reason] ?? table.default ?? reason;
}

/**
 * 获取指定 action 的全部 reason → message 映射（不含 default）。
 * 供 SessionActionDriver 等需要整表传入的组件使用。
 * @param {ReturnType<getLocale>} locale
 * @param {string} action
 * @returns {Record<string, string>}
 */
export function getErrorMessages(locale, action) {
  const table = locale.error?.[action];
  if (!table) return {};
  const { default: _default, ...messages } = table;
  return messages;
}
