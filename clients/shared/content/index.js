import EN_OVERLAY from './i18n/en.js';

const OVERLAYS = {
  en: EN_OVERLAY,
};

export function applyContentOverlay(content = {}, overlay = {}) {
  const nextCards = { ...(content.cards ?? {}) };
  for (const [id, cardOverlay] of Object.entries(overlay.cards ?? {})) {
    if (!nextCards[id]) continue;
    const display = { ...(nextCards[id].display ?? {}), ...cardOverlay };
    nextCards[id] = {
      ...nextCards[id],
      name: display.name ?? nextCards[id].name,
      desc: display.desc ?? nextCards[id].desc,
      type: display.type ?? nextCards[id].type,
      display,
    };
  }

  const nextStatuses = { ...(content.statuses ?? {}) };
  for (const [id, statusOverlay] of Object.entries(overlay.statuses ?? {})) {
    if (!nextStatuses[id]) continue;
    const display = { ...(nextStatuses[id].display ?? {}), ...statusOverlay };
    nextStatuses[id] = {
      ...nextStatuses[id],
      name: display.name ?? nextStatuses[id].name,
      desc: display.desc ?? nextStatuses[id].desc,
      display,
    };
  }

  const nextEnemies = { ...(content.enemies ?? {}) };
  for (const [typeId, enemyOverlay] of Object.entries(overlay.enemies ?? {})) {
    if (!nextEnemies[typeId]) continue;
    const current = nextEnemies[typeId];
    const display = enemyOverlay.name
      ? { ...(current.display ?? {}), name: enemyOverlay.name }
      : { ...(current.display ?? {}) };
    const actions = { ...(current.actions ?? {}) };

    for (const [actionId, desc] of Object.entries(enemyOverlay.actions ?? {})) {
      if (!actions[actionId]) continue;
      actions[actionId] = {
        ...actions[actionId],
        desc,
      };
    }

    nextEnemies[typeId] = {
      ...current,
      name: display.name ?? current.name,
      display,
      actions,
    };
  }

  return {
    ...content,
    cards: nextCards,
    statuses: nextStatuses,
    enemies: nextEnemies,
  };
}

export function localizeContent(content = {}, lang = 'zh') {
  const overlay = OVERLAYS[lang];
  if (!overlay) return content;
  return applyContentOverlay(content, overlay);
}
