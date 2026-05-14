function cloneDisplay(display = {}) {
  if (!display || typeof display !== 'object' || Array.isArray(display)) return {};
  return { ...display };
}

function buildCardCatalog(cards = {}) {
  const result = {};
  for (const [id, def] of Object.entries(cards)) {
    const display = cloneDisplay(def?.display);
    result[id] = {
      id,
      name: display.name ?? id,
      desc: display.desc ?? '',
      type: display.type ?? null,
      cost: def?.cost ?? 0,
      rarity: def?.rarity ?? null,
      targetType: def?.targetType ?? 'none',
      exhaust: !!def?.exhaust,
      display,
    };
  }
  return result;
}

function buildRelicCatalog(relicDefs = {}) {
  const result = {};
  for (const [id, def] of Object.entries(relicDefs)) {
    const display = cloneDisplay(def?.display);
    result[id] = {
      id,
      name: display.name ?? id,
      desc: display.desc ?? '',
      rarity: def?.rarity ?? null,
      shopPrice: def?.shopPrice ?? null,
      display,
    };
  }
  return result;
}

function buildStatusCatalog(statusModules = []) {
  const result = {};
  for (const mod of statusModules) {
    if (!mod?.id) continue;
    const display = cloneDisplay(mod.display);
    result[mod.id] = {
      id: mod.id,
      name: display.name ?? mod.id,
      desc: display.desc ?? '',
      display,
    };
  }
  return result;
}

function buildEnemyCatalog(enemyDefs = {}) {
  const result = {};
  for (const [typeId, def] of Object.entries(enemyDefs)) {
    const display = cloneDisplay(def?.display);
    const actions = {};
    for (const [actionId, action] of Object.entries(def?.actions ?? {})) {
      actions[actionId] = {
        id: actionId,
        type: action?.type ?? null,
        amount: action?.amount ?? null,
        desc: action?.desc ?? actionId,
      };
    }

    result[typeId] = {
      id: typeId,
      name: display.name ?? typeId,
      display,
      actions,
    };
  }
  return result;
}

export function createContentCatalog({
  cards = {},
  relicDefs = {},
  statusModules = [],
  enemyDefs = {},
} = {}) {
  return {
    cards: buildCardCatalog(cards),
    relics: buildRelicCatalog(relicDefs),
    statuses: buildStatusCatalog(statusModules),
    enemies: buildEnemyCatalog(enemyDefs),
  };
}

export function buildDisplayMapsFromContent(content = {}) {
  const statusDisplayMap = {};
  for (const [id, status] of Object.entries(content.statuses ?? {})) {
    statusDisplayMap[id] = {
      name: status.name ?? id,
      desc: status.desc ?? '',
    };
  }

  const enemyDisplayMap = {};
  for (const [typeId, enemy] of Object.entries(content.enemies ?? {})) {
    const actions = {};
    for (const [actionId, action] of Object.entries(enemy.actions ?? {})) {
      actions[actionId] = {
        type: action.type ?? null,
        desc: action.desc ?? actionId,
      };
    }

    enemyDisplayMap[typeId] = {
      display: { ...(enemy.display ?? {}), name: enemy.name ?? typeId },
      actions,
    };
  }

  const cards = {};
  for (const [id, card] of Object.entries(content.cards ?? {})) {
    cards[id] = {
      display: {
        ...(card.display ?? {}),
        name: card.name ?? id,
        desc: card.desc ?? '',
        ...(card.type ? { type: card.type } : {}),
      },
    };
  }

  return {
    cards,
    enemyDisplayMap,
    statusDisplayMap,
  };
}
