import { describe, expect, it } from 'vitest';

import {
  CARD_LAYOUT,
  CARD_TOOLTIP_LAYOUT,
} from '../../../../scenes/battle/view/battleCardLayout.js';

function rectEdges({ x, y, width, height }) {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

describe('battle card layout spec', () => {
  it('keeps card header and description panels inside the card bounds', () => {
    const cardWidth = CARD_LAYOUT.size.w;
    const cardHeight = CARD_LAYOUT.size.h;
    const cardBounds = {
      left: -cardWidth / 2,
      right: cardWidth / 2,
      top: -cardHeight / 2,
      bottom: cardHeight / 2,
    };

    const headerBounds = rectEdges(CARD_LAYOUT.header.panel);
    const descBounds = rectEdges(CARD_LAYOUT.description.panel);

    expect(headerBounds.left).toBeGreaterThanOrEqual(cardBounds.left);
    expect(headerBounds.right).toBeLessThanOrEqual(cardBounds.right);
    expect(headerBounds.top).toBeGreaterThanOrEqual(cardBounds.top);
    expect(headerBounds.bottom).toBeLessThanOrEqual(cardBounds.bottom);

    expect(descBounds.left).toBeGreaterThanOrEqual(cardBounds.left);
    expect(descBounds.right).toBeLessThanOrEqual(cardBounds.right);
    expect(descBounds.top).toBeGreaterThanOrEqual(cardBounds.top);
    expect(descBounds.bottom).toBeLessThanOrEqual(cardBounds.bottom);
  });

  it('keeps card zones distinct so header, art and description do not overlap', () => {
    const headerBottom = rectEdges(CARD_LAYOUT.header.panel).bottom;
    const descTop = CARD_LAYOUT.description.text.y;

    expect(headerBottom).toBeLessThan(CARD_LAYOUT.art.top);
    expect(CARD_LAYOUT.art.top).toBeLessThan(CARD_LAYOUT.art.bottom);
    expect(CARD_LAYOUT.art.bottom).toBeLessThan(descTop);
  });

  it('keeps tooltip title and description within the tooltip width budget', () => {
    const tooltipHalfWidth = CARD_TOOLTIP_LAYOUT.width / 2;
    const titleLeft = -tooltipHalfWidth + CARD_TOOLTIP_LAYOUT.title.x;
    const titleRight = titleLeft + CARD_TOOLTIP_LAYOUT.title.maxWidth;
    const descLeft = -tooltipHalfWidth + CARD_TOOLTIP_LAYOUT.description.x;
    const descRight = descLeft + CARD_TOOLTIP_LAYOUT.description.maxWidth;

    expect(titleLeft).toBeGreaterThanOrEqual(-tooltipHalfWidth);
    expect(titleRight).toBeLessThanOrEqual(tooltipHalfWidth);
    expect(descLeft).toBeGreaterThanOrEqual(-tooltipHalfWidth);
    expect(descRight).toBeLessThanOrEqual(tooltipHalfWidth);
  });
});
