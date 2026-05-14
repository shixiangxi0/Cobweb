function rowPositions(count, spacing, y) {
  if (count <= 0) return [];
  const startX = -spacing * (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * spacing,
    y,
  }));
}

function shelfPositions(count, width, y) {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y }];
  const spacing = Math.min(172, Math.max(136, width / (count - 1)));
  return rowPositions(count, spacing, y);
}

function shelfItems(spec, key) {
  return spec.shelves.find((shelf) => shelf.key === key)?.items ?? [];
}

function shopLayoutKey(spec) {
  const hasCards = shelfItems(spec, 'cards').length > 0;
  const hasRelics = shelfItems(spec, 'relics').length > 0;
  if (hasCards && hasRelics) return 'cards+relics';
  if (hasCards) return 'cards';
  if (hasRelics) return 'relics';
  return 'empty';
}

function shopNoticeText(spec) {
  if (spec.freeHint) return '遗物优惠生效：本店首件原价不高于 50 金的商品可免费带走。';
  return spec.notice;
}

function shopOfferNode(scene, offer, {
  x,
  y,
  scale,
  blocked,
  onBuyShopItem,
  screen,
  debugName,
}, helpers) {
  const onClick = () => onBuyShopItem?.(offer.index);
  const key = `shop:${offer.index}`;

  if (offer.kind === 'relic') {
    return helpers.registerOfferNode(screen, key, helpers.createRelicOffer(scene, offer, {
      x,
      y,
      scale,
      blocked,
      onClick,
      priceLabel: offer.priceLabel,
      priceSubLabel: offer.priceSubLabel,
      debugName,
    }));
  }

  return helpers.registerOfferNode(screen, key, helpers.createCardOffer(scene, offer, {
    x,
    y,
    scale,
    blocked,
    onClick,
    priceLabel: offer.priceLabel,
    priceSubLabel: offer.priceSubLabel,
    debugName,
  }));
}

function addShelfDecoration(scene, container, {
  x,
  y,
  width,
  label,
  theme,
  helpers,
}) {
  const railShadow = scene.add.rectangle(x, y + 12, width + 22, 18, 0x000000, 0.18);
  const rail = scene.add.rectangle(x, y, width, 12, theme.accentDark, 0.9)
    .setStrokeStyle(1, theme.frame, 0.3);
  const labelNode = helpers.createSectionLabel(scene, {
    x,
    y: y - 40,
    text: label,
    theme,
    width: Math.min(width, 240),
  });
  container.add([railShadow, rail, labelNode]);
}

function syncShopNotice(view, spec, theme) {
  const active = !!(spec.freeHint || spec.notice);
  view.notice.container.setVisible(active);
  if (!active) return;

  const fill = spec.freeHint ? 0x20402e : 0x1a140e;
  const stroke = spec.freeHint ? 0x4b8a67 : theme.frame;
  view.notice.box.setFillStyle(fill, 0.88);
  view.notice.box.setStrokeStyle(2, stroke, 0.86);
  view.notice.body
    .setText(shopNoticeText(spec))
    .setColor(spec.freeHint ? '#d7f6e3' : theme.soft);
}

function renderShopMarket(view, screen, spec, blocked, helpers) {
  const { scene, callbacks } = screen;
  const { theme, marketContainer, layout } = view;
  const cardItems = shelfItems(spec, 'cards');
  const relicItems = shelfItems(spec, 'relics');
  const hasCards = cardItems.length > 0;
  const hasRelics = relicItems.length > 0;
  const { marketCenterX, marketTop, marketWidth } = layout;

  marketContainer.removeAll(true);
  helpers.clearOfferNodes(screen);

  if (hasCards && hasRelics) {
    addShelfDecoration(scene, marketContainer, {
      x: marketCenterX,
      y: marketTop + 86,
      width: Math.min(marketWidth - 28, 540),
      label: '卡牌货架',
      theme,
      helpers,
    });
    addShelfDecoration(scene, marketContainer, {
      x: marketCenterX,
      y: marketTop + 262,
      width: Math.min(marketWidth - 48, 420),
      label: '遗物展台',
      theme,
      helpers,
    });

    const cardPositions = shelfPositions(cardItems.length, Math.min(marketWidth - 180, 520), marketTop + 20);
    for (let index = 0; index < cardItems.length; index += 1) {
      const offer = cardItems[index];
      const pos = cardPositions[index] ?? { x: 0, y: marketTop + 20 };
      const node = shopOfferNode(scene, offer, {
        x: marketCenterX + pos.x,
        y: pos.y,
        scale: 0.82,
        blocked,
        onBuyShopItem: callbacks.onBuyShopItem,
        screen,
        debugName: `flow.shop.cards.${index}`,
      }, helpers);
      marketContainer.add(node);
    }

    const relicPositions = shelfPositions(relicItems.length, Math.min(marketWidth - 260, 320), marketTop + 202);
    for (let index = 0; index < relicItems.length; index += 1) {
      const offer = relicItems[index];
      const pos = relicPositions[index] ?? { x: 0, y: marketTop + 202 };
      const node = shopOfferNode(scene, offer, {
        x: marketCenterX + pos.x,
        y: pos.y,
        scale: 0.8,
        blocked,
        onBuyShopItem: callbacks.onBuyShopItem,
        screen,
        debugName: `flow.shop.relics.${index}`,
      }, helpers);
      marketContainer.add(node);
    }
    return;
  }

  if (hasCards || hasRelics) {
    const items = hasCards ? cardItems : relicItems;
    const label = hasCards ? '卡牌货架' : '遗物展台';
    const scale = hasCards ? 0.88 : 0.84;
    const shelfY = marketTop + 180;
    addShelfDecoration(scene, marketContainer, {
      x: marketCenterX,
      y: shelfY,
      width: Math.min(marketWidth - 40, hasCards ? 560 : 420),
      label,
      theme,
      helpers,
    });
    const positions = shelfPositions(items.length, Math.min(marketWidth - 140, hasCards ? 560 : 380), marketTop + 94);
    for (let index = 0; index < items.length; index += 1) {
      const offer = items[index];
      const pos = positions[index] ?? { x: 0, y: marketTop + 94 };
      const node = shopOfferNode(scene, offer, {
        x: marketCenterX + pos.x,
        y: pos.y,
        scale,
        blocked,
        onBuyShopItem: callbacks.onBuyShopItem,
        screen,
        debugName: hasCards ? `flow.shop.cards.${index}` : `flow.shop.relics.${index}`,
      }, helpers);
      marketContainer.add(node);
    }
    return;
  }

  const empty = scene.add.text(marketCenterX, 28, '今天的商铺空空如也。', {
    fontFamily: helpers.fontUi,
    fontSize: '18px',
    color: theme.soft,
  }).setOrigin(0.5);
  marketContainer.add(empty);
}

export const shopPhaseController = {
  kind: 'shop',
  stepKinds: ['shop_enter', 'shop_buy', 'shop_leave'],

  supportsViewState(viewState) {
    return (viewState?.phase ?? 'battle') === 'shop';
  },

  supportsStep(step) {
    return this.stepKinds.includes(step?.kind);
  },

  buildSpec(viewState) {
    const shelves = viewState?.shop?.shelves ?? [];
    return {
      kind: 'shop',
      title: '商店',
      subtitle: '浏览货架并直接购买商品。',
      goldText: `金币 ${viewState?.run?.gold ?? 0}`,
      notice: viewState?.shop?.notice ?? '',
      freeHint: shelves.some((shelf) => (shelf.items ?? []).some((item) => item.freeEligible)),
      shelves,
    };
  },

  signature(scene, spec) {
    return JSON.stringify({
      kind: spec.kind,
      width: scene.W,
      height: scene.H,
      goldText: spec.goldText,
      notice: spec.notice,
      shelves: spec.shelves.map((shelf) => [
        shelf.key,
        (shelf.items ?? []).map((item) => [
          item.index,
          item.kind,
          item.id,
          item.priceLabel,
          item.priceSubLabel,
          !!item.canAfford,
          !!item.freeEligible,
        ]),
      ]),
    });
  },

  build(screen, spec, blocked, helpers) {
    const { scene, root, callbacks } = screen;
    const theme = helpers.flowTheme(this.kind);
    const header = helpers.createHeader(scene, spec, theme);
    root.add(header);

    const hasCards = shelfItems(spec, 'cards').length > 0;
    const hasRelics = shelfItems(spec, 'relics').length > 0;
    const panel = helpers.createScreenPanel(scene, {
      x: scene.W / 2,
      y: scene.H * 0.57,
      width: Math.min(scene.W - 104, 1140),
      height: Math.min(scene.H - 124, hasCards && hasRelics ? 558 : 486),
      title: '商旅驿站',
      subtitle: '',
      theme,
      footerHeight: 82,
      debugName: 'flow.shop.panel',
    });
    root.add(panel.container);

    const leftInset = 34;
    const rightInset = 34;
    const gap = 28;
    const sidebarWidth = Math.min(252, panel.width * 0.25);
    const marketWidth = panel.width - leftInset - rightInset - sidebarWidth - gap;
    const sidebarX = -panel.width / 2 + leftInset + sidebarWidth / 2;
    const marketCenterX = -panel.width / 2 + leftInset + sidebarWidth + gap + marketWidth / 2;
    const marketTop = panel.contentTop + 24;
    const marketBottom = panel.contentBottom - 18;

    const sidebarHeight = marketBottom - marketTop + 42;
    const sidebarBg = scene.add.rectangle(sidebarX, 12, sidebarWidth, sidebarHeight, theme.accentDark, 0.54)
      .setStrokeStyle(1, theme.frame, 0.3);
    const sidebarGlow = scene.add.circle(sidebarX, -78, 72, theme.accent, 0.07);
    const sidebarTitle = scene.add.text(sidebarX - sidebarWidth / 2 + 22, -144, '行商驻点', {
      fontFamily: '"Georgia", "Times New Roman", serif',
      fontSize: '24px',
      color: theme.text,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const sidebarIntro = scene.add.text(sidebarX - sidebarWidth / 2 + 22, -104, '悬浮查看，点击成交。商品会立刻写入当前状态。', {
      fontFamily: helpers.fontUi,
      fontSize: '13px',
      color: theme.soft,
      wordWrap: { width: sidebarWidth - 44 },
      lineSpacing: 4,
    }).setOrigin(0, 0);
    panel.container.add([sidebarBg, sidebarGlow, sidebarTitle, sidebarIntro]);

    const noticeContainer = scene.add.container(0, 0);
    const noticeBox = scene.add.rectangle(sidebarX, -18, sidebarWidth - 28, 84, 0x1a140e, 0.88)
      .setStrokeStyle(2, theme.frame, 0.86);
    const noticeLabel = scene.add.text(sidebarX - (sidebarWidth - 28) / 2 + 16, -44, '本店提示', {
      fontFamily: helpers.fontUi,
      fontSize: '11px',
      color: theme.text,
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0, 0.5);
    const noticeBody = scene.add.text(sidebarX - (sidebarWidth - 28) / 2 + 16, -8, '', {
      fontFamily: helpers.fontUi,
      fontSize: '12px',
      color: theme.soft,
      wordWrap: { width: sidebarWidth - 60 },
      lineSpacing: 4,
    }).setOrigin(0, 0.5);
    noticeContainer.add([noticeBox, noticeLabel, noticeBody]);
    panel.container.add(noticeContainer);

    const hintBox = scene.add.rectangle(sidebarX, 96, sidebarWidth - 28, 104, 0x17110c, 0.82)
      .setStrokeStyle(1, theme.frame, 0.28);
    const hintLabel = scene.add.text(sidebarX - (sidebarWidth - 28) / 2 + 16, 58, '购买规则', {
      fontFamily: helpers.fontUi,
      fontSize: '11px',
      color: theme.text,
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0, 0.5);
    const hintBody = scene.add.text(sidebarX - (sidebarWidth - 28) / 2 + 16, 102, '卡牌与遗物会直接生效。\n金币不足的商品会变暗，无法点击。', {
      fontFamily: helpers.fontUi,
      fontSize: '12px',
      color: theme.soft,
      wordWrap: { width: sidebarWidth - 60 },
      lineSpacing: 4,
    }).setOrigin(0, 0.5);
    panel.container.add([hintBox, hintLabel, hintBody]);

    const dividerX = -panel.width / 2 + leftInset + sidebarWidth + gap / 2;
    const divider = scene.add.rectangle(dividerX, 12, 2, sidebarHeight, theme.frame, 0.22);
    panel.container.add(divider);

    const marketContainer = scene.add.container(0, 0);
    panel.container.add(marketContainer);

    const footerHint = scene.add.text(-panel.width / 2 + 34, panel.footerCenterY, '悬浮查看，点击商品立即购买', {
      fontFamily: helpers.fontUi,
      fontSize: '13px',
      color: theme.soft,
    }).setOrigin(0, 0.5);
    const leaveButton = helpers.registerInteractiveNode(screen, 'action:shop:leave', helpers.createActionButton(scene, {
      x: panel.width / 2 - 122,
      y: panel.footerCenterY,
      width: 180,
      label: '离开商店',
      kind: 'secondary',
      blocked,
      onClick: () => callbacks.onLeaveShop?.(),
      debugName: 'flow.shop.leave',
    }));
    panel.container.add([footerHint, leaveButton]);

    const view = {
      theme,
      header,
      panel,
      notice: {
        container: noticeContainer,
        box: noticeBox,
        body: noticeBody,
      },
      marketContainer,
      layout: {
        marketCenterX,
        marketTop,
        marketWidth,
      },
    };
    syncShopNotice(view, spec, theme);
    renderShopMarket(view, screen, spec, blocked, helpers);
    return view;
  },

  refresh(screen, spec, blocked, helpers, { previousSpec = null, view = null } = {}) {
    if (!view || !previousSpec) return false;
    if (shopLayoutKey(previousSpec) !== shopLayoutKey(spec)) return false;
    if (!helpers.syncHeader(view.header, spec)) return false;

    syncShopNotice(view, spec, view.theme);
    renderShopMarket(view, screen, spec, blocked, helpers);
    return true;
  },

  async playStep(screen, step, {
    animQueue,
    currentViewState = null,
    nextViewState = null,
    blocked = true,
  } = {}, helpers) {
    switch (step.kind) {
      case 'shop_enter':
        await helpers.animateScreenOut(screen, animQueue);
        helpers.syncScreen(screen, nextViewState, { blocked, force: true, hidden: true });
        await helpers.animateScreenIn(screen, animQueue);
        return true;

      case 'shop_buy':
        screen.state.phase = helpers.FLOW_PHASES.resolving;
        await helpers.pulseOffer(screen, `shop:${step.data?.index ?? ''}`, animQueue, { consume: true });
        await helpers.showFlowToast(
          screen,
          step.data?.price > 0 ? `成交，花费 ${step.data.price} 金` : '免费收入囊中',
          {
            fill: 0x163a2a,
            stroke: 0x4b8a67,
            color: '#d6ffe8',
          },
          animQueue,
        );
        helpers.syncScreen(screen, nextViewState, { blocked, force: true });
        return true;

      case 'shop_leave':
        await helpers.animateScreenOut(screen, animQueue);
        return true;

      default:
        return false;
    }
  },
};
