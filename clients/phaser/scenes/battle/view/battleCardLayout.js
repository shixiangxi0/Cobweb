import { LAYOUT } from '../../../src/constants.js';

const CARD_WIDTH = LAYOUT.cardSize.w;
const CARD_HEIGHT = LAYOUT.cardSize.h;
const CARD_HALF_WIDTH = CARD_WIDTH / 2;
const CARD_HALF_HEIGHT = CARD_HEIGHT / 2;

export const CARD_FONT_STACKS = {
  ui: '"Microsoft YaHei", "PingFang SC", "Trebuchet MS", sans-serif',
  display: '"Microsoft YaHei", "PingFang SC", "Trebuchet MS", sans-serif',
};

export const CARD_LAYOUT = {
  size: LAYOUT.cardSize,
  header: {
    panel: {
      x: 0,
      y: -CARD_HALF_HEIGHT + 27,
      width: CARD_WIDTH - 24,
      height: 24,
    },
    seal: {
      x: -CARD_HALF_WIDTH + 26,
      y: -CARD_HALF_HEIGHT + 27,
    },
    cost: {
      x: -CARD_HALF_WIDTH + 26,
      y: -CARD_HALF_HEIGHT + 27,
    },
    title: {
      x: 12,
      y: -CARD_HALF_HEIGHT + 26,
      maxWidth: 102,
      minFontSize: 12,
    },
  },
  art: {
    top: -CARD_HALF_HEIGHT + 56,
    bottom: -CARD_HALF_HEIGHT + 156,
  },
  description: {
    panel: {
      x: 0,
      y: -CARD_HALF_HEIGHT + 192,
      width: CARD_WIDTH - 16,
      height: 62,
    },
    text: {
      x: 0,
      y: -CARD_HALF_HEIGHT + 168,
      maxWidth: CARD_WIDTH - 34,
      maxHeight: 50,
      maxLines: 3,
      minFontSize: 11,
    },
  },
};

export const CARD_TOOLTIP_LAYOUT = {
  width: 286,
  minHeight: 128,
  shadowOffsetY: 6,
  accentBar: {
    width: 5,
    insetX: 13,
    insetY: 12,
  },
  rules: {
    topY: 38,
    bottomInset: 18,
  },
  seal: {
    x: 36,
    y: 30,
  },
  cost: {
    x: 36,
    y: 30,
  },
  title: {
    x: 68,
    y: 18,
    maxWidth: 178,
    minFontSize: 12,
  },
  description: {
    x: 20,
    y: 54,
    maxWidth: 246,
    maxHeight: 164,
    maxLines: 8,
    minFontSize: 11,
  },
};

