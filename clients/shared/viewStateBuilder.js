import {
  coerceBattleZoneList,
  getBattleCard,
  getBattlePlayer,
  getBattleRuntime,
} from '../../games/sts/src/shared/battleState.js';
import { resolveGamePhase } from '../../games/sts/src/state/phase.js';
import { getLocale } from './locale.js';

export function createRenderViewStateBuilder({
  content = null,
  lang = 'zh',
  route = null,
}) {
  const locale = getLocale(lang);
  const cardContent = content?.cards ?? {};
  const relicContent = content?.relics ?? {};
  const statusContent = content?.statuses ?? {};
  const enemyContent = content?.enemies ?? {};

  function clampFloorIndex(floorIndex = 0) {
    const floorCount = route?.floors?.length ?? 0;
    if (floorCount <= 0) return 0;
    const numeric = Number.isFinite(floorIndex) ? Math.trunc(floorIndex) : 0;
    return Math.max(0, Math.min(numeric, floorCount - 1));
  }

  function resolveRouteFloor(progress = null) {
    if (!route?.floors?.length) return null;
    return route.floors[clampFloorIndex(progress?.floorIndex ?? 0)] ?? null;
  }

  function resolveNextRouteFloor(progress = null) {
    if (!route?.floors?.length) return null;
    const nextIndex = (progress?.floorIndex ?? 0) + 1;
    if (nextIndex >= route.floors.length) return null;
    return route.floors[clampFloorIndex(nextIndex)] ?? null;
  }

  function enrichStatuses(rawStatuses) {
    if (!rawStatuses || typeof rawStatuses !== 'object') return {};
    const result = {};
    for (const [id, val] of Object.entries(rawStatuses)) {
      const stacks = typeof val === 'object' ? val.stacks : val;
      const template = statusContent[id]?.desc ?? null;
      const desc = template ? template.replace(/\{stacks\}/g, stacks ?? 0) : null;
      result[id] = desc !== null ? { stacks, desc } : { stacks };
    }
    return result;
  }

  function buildRunProgressView(state) {
    const progress = state.run?.progress ?? null;
    const currentFloor = resolveRouteFloor(progress);
    const nextFloor = resolveNextRouteFloor(progress);
    const floorCount = progress?.floorCount ?? route?.floors?.length ?? 0;
    const floorIndex = Number.isFinite(progress?.floorIndex) ? progress.floorIndex : 0;

    return {
      routeId: progress?.routeId ?? route?.id ?? null,
      routeName: progress?.routeName ?? route?.name ?? null,
      floorIndex,
      floorCount,
      completed: !!progress?.completed,
      currentFloorId: currentFloor?.id ?? progress?.floorId ?? null,
      currentFloorLabel: currentFloor?.label ?? progress?.floorLabel ?? null,
      nextFloorId: nextFloor?.id ?? null,
      nextFloorLabel: nextFloor?.label ?? null,
      label: currentFloor?.label
        ?? progress?.floorLabel
        ?? route?.name
        ?? locale.ui.reward.runTitleFallback
        ?? locale.ui.title,
    };
  }

  function buildRelicViewEntry(id) {
    const entry = relicContent[id];
    return {
      id,
      name: entry?.name ?? id,
      desc: entry?.desc ?? '',
    };
  }

  function buildRunView(state) {
    const run = state.run ?? {};
    const shop = state.shop;
    return {
      gold: shop?.gold ?? run.gold ?? 0,
      relics: run.relics ?? [],
      relicEntries: (run.relics ?? []).map((id) => buildRelicViewEntry(id)),
      potions: run.potions ?? [],
      progress: buildRunProgressView(state),
    };
  }

  function buildPhaseShell(state, phase) {
    const battle = state.battle ?? {};
    return {
      phase,
      run: buildRunView(state),
      over: !!battle.over,
      victory: !!battle.victory,
      rewardOffered: !!state.reward,
    };
  }

  function buildBattleView(state) {
    const runtime = getBattleRuntime(state);
    const enemies = [];
    for (const slot of Object.keys(runtime.enemies ?? {}).sort()) {
      const eid = runtime.enemies[slot];
      if (!eid) continue;
      const enemy = runtime.entities[eid];
      if (enemy.hp <= 0) continue;
      const entry = enemyContent[enemy.typeId] ?? null;
      const intentAction = entry?.actions?.[enemy.intent] ?? null;
      enemies.push({
        slot: Number(slot),
        typeId: enemy.typeId,
        entityId: eid,
        name: entry?.name ?? enemy.typeId,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.statuses?.block?.stacks ?? 0,
        statuses: enrichStatuses(enemy.statuses),
        intentType: intentAction?.type ?? null,
        intentDesc: intentAction?.desc ?? (enemy.intent ?? locale.unknown),
      });
    }

    const hand = coerceBattleZoneList(runtime.hand).map((instanceId) => {
      const inst = getBattleCard(state, instanceId);
      const entry = cardContent[inst.cardId] ?? null;
      const display = entry?.display ?? {};
      return {
        instanceId,
        cardId: inst.cardId,
        display,
        cost: inst.cost,
        targetType: entry?.targetType,
        exhaust: entry?.exhaust ?? false,
      };
    });

    const player = getBattlePlayer(state);
    const playerStatuses = enrichStatuses(player.statuses);

    return {
      player: {
        hp: player.hp,
        maxHp: player.maxHp,
        energy: player.energy,
        maxEnergy: player.maxEnergy,
        block: player.statuses?.block?.stacks ?? 0,
        statuses: playerStatuses,
      },
      enemies,
      hand,
      piles: {
        draw: coerceBattleZoneList(runtime.drawPile).length,
        discard: coerceBattleZoneList(runtime.discardPile).length,
        exhaust: coerceBattleZoneList(runtime.exhaustPile).length,
      },
      turn: runtime.turn,
      statusGroups: [
        { title: locale.player, values: playerStatuses },
        ...enemies.map((enemy) => ({ title: enemy.name, values: enemy.statuses })),
      ],
    };
  }

  function buildShopView(state) {
    const shop = state.shop ?? null;
    if (!shop) return null;

    const gold = shop.gold ?? state.run?.gold ?? 0;
    const stock = Array.isArray(shop.stock) ? shop.stock : [];
    const offers = stock.map((item, index) => {
      const cardEntry = item.type === 'card' ? cardContent[item.id] ?? null : null;
      const relicEntry = item.type === 'relic' ? relicContent[item.id] ?? null : null;
      const display = cardEntry?.display ?? relicEntry?.display ?? {};
      const basePrice = item.basePrice;
      const price = item.price ?? 0;
      const discountedPrice = item.discountedPrice ?? price;
      const hasDiscount = discountedPrice < basePrice;

      return {
        index,
        kind: item.type,
        id: item.id,
        originalPrice: basePrice,
        price,
        discounted: hasDiscount,
        freeEligible: item.freeEligible,
        canAfford: item.canAfford ?? false,
        priceLabel: item.freeEligible
          ? locale.ui.shop.priceFree
          : locale.ui.shop.priceGold(price),
        priceSubLabel: item.freeEligible
          ? (hasDiscount ? locale.ui.shop.priceDiscounted(discountedPrice) : locale.ui.shop.priceOriginal(basePrice))
          : (hasDiscount ? locale.ui.shop.priceOriginal(basePrice) : null),
        name: cardEntry?.name ?? relicEntry?.name ?? display.name ?? item.id,
        desc: cardEntry?.desc ?? relicEntry?.desc ?? display.desc ?? '',
        rarity: cardEntry?.rarity ?? relicEntry?.rarity ?? null,
        display,
      };
    });

    const shelves = [
      {
        key: 'cards',
        title: locale.ui.shop.shelfCardsTitle,
        subtitle: locale.ui.shop.shelfCardsSubtitle,
        items: offers.filter((item) => item.kind === 'card'),
      },
      {
        key: 'relics',
        title: locale.ui.shop.shelfRelicsTitle,
        subtitle: locale.ui.shop.shelfRelicsSubtitle,
        items: offers.filter((item) => item.kind === 'relic'),
      },
    ].filter((shelf) => shelf.items.length > 0);

    const hasFreeOffer = offers.some((item) => item.freeEligible);
    return {
      gold,
      shelves,
      ...(hasFreeOffer && {
        notice: locale.ui.shop.noticeFreeOffer,
      }),
    };
  }

  function buildRewardView(state) {
    const reward = state.reward ?? null;
    if (!reward) return null;

    const entries = Array.isArray(reward.entries) ? reward.entries : [];
    return {
      entries: entries.map((entry, index) => {
        if (entry.kind === 'gold') {
          const amount = entry.amount ?? 0;
          return {
            index,
            key: entry.key ?? `gold:${index}`,
            kind: 'gold',
            amount,
            name: locale.ui.reward.goldName ?? 'Gold',
            desc: locale.ui.reward.goldDesc?.(amount) ?? `Gain ${amount} gold.`,
            badge: locale.ui.reward.goldBadge?.(amount) ?? `+${amount}`,
          };
        }

        if (entry.kind === 'card') {
          const cardEntry = cardContent[entry.cardId] ?? null;
          return {
            index,
            key: entry.key ?? `card:${entry.cardId}`,
            kind: 'card',
            cardId: entry.cardId,
            name: cardEntry?.name ?? entry.cardId,
            desc: cardEntry?.desc ?? '',
            type: cardEntry?.type,
            rarity: cardEntry?.rarity,
            cost: cardEntry?.cost,
            display: cardEntry?.display ?? {},
          };
        }

        if (entry.kind === 'relic') {
          const relicEntry = relicContent[entry.relicId] ?? null;
          return {
            index,
            key: entry.key ?? `relic:${entry.relicId}`,
            kind: 'relic',
            relicId: entry.relicId,
            name: relicEntry?.name ?? entry.relicId,
            desc: relicEntry?.desc ?? '',
            rarity: relicEntry?.rarity,
            display: relicEntry?.display ?? {},
          };
        }

        return null;
      }).filter(Boolean),
    };
  }

  function buildViewState(state) {
    const phase = resolveGamePhase(state);
    const shell = buildPhaseShell(state, phase);

    if (phase === 'reward') {
      return {
        ...shell,
        reward: buildRewardView(state),
      };
    }

    if (phase === 'shop') {
      return {
        ...shell,
        shop: buildShopView(state),
      };
    }

    return {
      ...shell,
      ...buildBattleView(state),
    };
  }

  return { buildViewState };
}
