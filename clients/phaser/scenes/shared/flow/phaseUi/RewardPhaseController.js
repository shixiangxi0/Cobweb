function rowPositions(count, spacing, y) {
  if (count <= 0) return [];
  const startX = -spacing * (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * spacing,
    y,
  }));
}

function rewardGridPositions(count, width) {
  if (count <= 0) return [];

  if (count <= 4) {
    const spacing = count > 1
      ? Math.min(212, Math.max(176, width / (count - 1)))
      : 0;
    return rowPositions(count, spacing, 32);
  }

  const topCount = Math.ceil(count / 2);
  const bottomCount = count - topCount;
  const topSpacing = topCount > 1
    ? Math.min(196, Math.max(164, width / (topCount - 1)))
    : 0;
  const bottomSpacing = bottomCount > 1
    ? Math.min(196, Math.max(164, width / (bottomCount - 1)))
    : 0;

  return [
    ...rowPositions(topCount, topSpacing, -36),
    ...rowPositions(bottomCount, bottomSpacing, 92),
  ];
}

function rewardDensityKey(spec) {
  return spec.entries.length > 4 ? 'dense' : 'normal';
}

function rewardEntryNode(scene, entry, {
  x,
  y,
  scale = 1,
  blocked,
  onClaimReward,
  screen,
  debugName,
}, helpers) {
  const onClick = () => onClaimReward?.({ key: entry.key });
  const key = `reward:${entry.key}`;

  if (entry.kind === 'gold') {
    return helpers.registerOfferNode(screen, key, helpers.createGoldOffer(scene, entry, {
      x,
      y,
      scale,
      blocked,
      onClick,
      debugName,
    }));
  }

  if (entry.kind === 'relic') {
    return helpers.registerOfferNode(screen, key, helpers.createRelicOffer(scene, entry, {
      x,
      y,
      scale,
      blocked,
      onClick,
      debugName,
    }));
  }

  return helpers.registerOfferNode(screen, key, helpers.createCardOffer(scene, entry, {
    x,
    y,
    scale,
    blocked,
    onClick,
    debugName,
  }));
}

function renderRewardEntries(view, screen, spec, blocked, helpers) {
  const { scene, callbacks } = screen;
  const { theme, entriesContainer, layout } = view;
  entriesContainer.removeAll(true);
  helpers.clearOfferNodes(screen);

  const positions = rewardGridPositions(
    spec.entries.length,
    Math.min(layout.panelWidth - 280, 700),
  );
  const scale = spec.entries.length > 4 ? 0.82 : 0.92;

  for (let index = 0; index < spec.entries.length; index += 1) {
    const entry = spec.entries[index];
    const position = positions[index] ?? { x: 0, y: 32 };
    const node = rewardEntryNode(scene, entry, {
      x: position.x,
      y: position.y,
      scale,
      blocked,
      onClaimReward: callbacks.onClaimReward,
      screen,
      debugName: `flow.reward.entry.${index}`,
    }, helpers);
    entriesContainer.add(node);
  }

  if (spec.entries.length === 0) {
    const empty = scene.add.text(0, 28, '这一战没有可领取的奖励。', {
      fontFamily: helpers.fontUi,
      fontSize: '18px',
      color: theme.soft,
    }).setOrigin(0.5);
    entriesContainer.add(empty);
  }
}

export const rewardPhaseController = {
  kind: 'reward',
  stepKinds: ['reward_open', 'reward_claim', 'reward_skip'],

  supportsViewState(viewState) {
    return (viewState?.phase ?? 'battle') === 'reward';
  },

  supportsStep(step) {
    return this.stepKinds.includes(step?.kind);
  },

  buildSpec(viewState) {
    return {
      kind: 'reward',
      title: '战利品',
      subtitle: '战斗结束后，从本次收获中挑选一项带走。',
      goldText: `金币 ${viewState?.run?.gold ?? 0}`,
      entries: viewState?.reward?.entries ?? [],
    };
  },

  signature(scene, spec) {
    return JSON.stringify({
      kind: spec.kind,
      width: scene.W,
      height: scene.H,
      goldText: spec.goldText,
      entries: spec.entries.map((entry) => [
        entry.key,
        entry.kind,
        entry.cardId ?? null,
        entry.relicId ?? null,
        entry.amount ?? 0,
      ]),
    });
  },

  build(screen, spec, blocked, helpers) {
    const { scene, root, callbacks } = screen;
    const theme = helpers.flowTheme(this.kind);
    const header = helpers.createHeader(scene, spec, theme);
    root.add(header);

    const panel = helpers.createScreenPanel(scene, {
      x: scene.W / 2,
      y: scene.H * 0.56,
      width: Math.min(scene.W - 116, 1060),
      height: Math.min(scene.H - 138, spec.entries.length > 4 ? 544 : 472),
      title: '挑选一项奖励',
      subtitle: '',
      theme,
      footerHeight: 82,
      debugName: 'flow.reward.panel',
    });
    root.add(panel.container);

    const intro = scene.add.text(0, panel.contentTop + 10, '从本次战斗的收获中挑选一项。', {
      fontFamily: helpers.fontUi,
      fontSize: '16px',
      color: theme.soft,
    }).setOrigin(0.5);
    const halo = scene.add.circle(0, 20, 204, theme.accent, 0.06);
    const stage = scene.add.ellipse(0, 58, Math.min(panel.width - 140, 700), 194, theme.accentDark, 0.3)
      .setStrokeStyle(1, theme.frame, 0.22);
    const label = helpers.createSectionLabel(scene, {
      x: 0,
      y: panel.contentTop + 42,
      text: '可选奖励',
      theme,
      width: 260,
    });
    panel.container.add([halo, stage, intro, label]);

    const entriesContainer = scene.add.container(0, 0);
    panel.container.add(entriesContainer);

    const footerHint = scene.add.text(-panel.width / 2 + 34, panel.footerCenterY, '点击奖励立即领取', {
      fontFamily: helpers.fontUi,
      fontSize: '13px',
      color: theme.soft,
    }).setOrigin(0, 0.5);
    const skipButton = helpers.registerInteractiveNode(screen, 'action:reward:skip', helpers.createActionButton(scene, {
      x: panel.width / 2 - 118,
      y: panel.footerCenterY,
      width: 172,
      label: '跳过奖励',
      kind: 'secondary',
      blocked,
      onClick: () => callbacks.onSkipReward?.(),
      debugName: 'flow.reward.skip',
    }));
    panel.container.add([footerHint, skipButton]);

    const view = {
      theme,
      header,
      panel,
      entriesContainer,
      layout: {
        panelWidth: panel.width,
      },
    };
    renderRewardEntries(view, screen, spec, blocked, helpers);
    return view;
  },

  refresh(screen, spec, blocked, helpers, { previousSpec = null, view = null } = {}) {
    if (!view || !previousSpec) return false;
    if (rewardDensityKey(previousSpec) !== rewardDensityKey(spec)) return false;
    if (!helpers.syncHeader(view.header, spec)) return false;

    renderRewardEntries(view, screen, spec, blocked, helpers);
    return true;
  },

  async playStep(screen, step, {
    animQueue,
    currentViewState = null,
    nextViewState = null,
    blocked = true,
  } = {}, helpers) {
    switch (step.kind) {
      case 'reward_open':
        await helpers.animateScreenOut(screen, animQueue);
        helpers.syncScreen(screen, nextViewState, { blocked, force: true, hidden: true });
        await helpers.animateScreenIn(screen, animQueue);
        return true;

      case 'reward_claim':
        screen.state.phase = helpers.FLOW_PHASES.resolving;
        await helpers.pulseOffer(screen, `reward:${step.data?.key ?? ''}`, animQueue, { consume: false });
        await helpers.showFlowToast(screen, '奖励已收入囊中', {
          fill: 0x2a1e12,
          stroke: 0xcf9030,
        }, animQueue);
        if ((nextViewState?.phase ?? 'battle') !== 'reward') {
          await helpers.animateScreenOut(screen, animQueue);
        }
        screen.state.phase = helpers.FLOW_PHASES.idle;
        return true;

      case 'reward_skip':
        await helpers.showFlowToast(screen, '你放弃了这次奖励', {
          fill: 0x2a1e12,
          stroke: 0x8a6a3d,
        }, animQueue);
        await helpers.animateScreenOut(screen, animQueue);
        return true;

      default:
        return false;
    }
  },
};
