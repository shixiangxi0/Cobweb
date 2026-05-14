import { describe, expect, it } from 'vitest';

import { loadModules } from '../src/content/loader.js';
import { buildDisplayMapsFromContent } from '../src/shared/content/catalog.js';
import { localizeContent } from '../../../clients/shared/content/index.js';

describe('shared content catalog', () => {
  it('aligns canonical content entries with render-side overlays and derived display maps', () => {
    const modules = loadModules({});
    const content = localizeContent(modules.content, 'en');
    const displayMaps = buildDisplayMapsFromContent(content);

    expect(content.cards.strike).toMatchObject({
      id: 'strike',
      name: 'Strike',
      desc: 'Deal 6 damage.',
      cost: 1,
      targetType: 'enemy',
    });
    expect(displayMaps.cards.strike.display).toMatchObject({
      name: 'Strike',
      desc: 'Deal 6 damage.',
    });

    expect(content.statuses.weak).toMatchObject({
      id: 'weak',
      name: 'Weak',
      desc: 'Attacks deal 25% less damage.',
    });
    expect(displayMaps.statusDisplayMap.weak).toMatchObject({
      name: 'Weak',
      desc: 'Attacks deal 25% less damage.',
    });

    expect(content.enemies.jaw_worm).toMatchObject({
      id: 'jaw_worm',
      name: 'Jaw Worm',
    });
    expect(content.enemies.jaw_worm.actions.bite).toMatchObject({
      id: 'bite',
      type: 'attack',
      desc: 'Deal 11 damage.',
    });
    expect(displayMaps.enemyDisplayMap.jaw_worm).toMatchObject({
      display: { name: 'Jaw Worm' },
      actions: { bite: { type: 'attack', desc: 'Deal 11 damage.' } },
    });
  });
});
