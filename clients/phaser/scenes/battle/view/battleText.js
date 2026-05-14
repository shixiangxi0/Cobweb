const DEFAULT_FONT_SIZE = 16;
const FIT_EPSILON = 0.5;

function normalizeTextValue(text) {
  if (text == null) return '';
  return String(text).replace(/\r\n/g, '\n').trim();
}

function parseFontSize(fontSize, fallback = DEFAULT_FONT_SIZE) {
  if (Number.isFinite(fontSize)) return fontSize;
  const match = /-?\d+(?:\.\d+)?/.exec(String(fontSize ?? ''));
  return match ? Number(match[0]) : fallback;
}

function ensureFontTemplate(node, fallbackSize) {
  if (!node) return `${fallbackSize}px`;
  if (!node.__fitFontTemplate) {
    node.__fitFontTemplate = typeof node.style?.fontSize === 'string' && node.style.fontSize.trim()
      ? node.style.fontSize
      : `${fallbackSize}px`;
  }
  return node.__fitFontTemplate;
}

function setNodeFontSize(node, nextSize) {
  if (!node?.setFontSize) return;
  const size = Math.max(1, Math.round(nextSize));
  const template = ensureFontTemplate(node, size);
  if (typeof template === 'string' && template.includes('px')) {
    node.setFontSize(`${size}px`);
    return;
  }
  node.setFontSize(size);
}

function ensureBaseFontSize(node, baseFontSize) {
  if (!node) return DEFAULT_FONT_SIZE;

  if (Number.isFinite(baseFontSize) && baseFontSize > 0) {
    node.__fitBaseFontSize = baseFontSize;
  } else if (!Number.isFinite(node.__fitBaseFontSize) || node.__fitBaseFontSize <= 0) {
    node.__fitBaseFontSize = parseFontSize(node.style?.fontSize, DEFAULT_FONT_SIZE);
  }

  ensureFontTemplate(node, node.__fitBaseFontSize);
  return node.__fitBaseFontSize;
}

function setWordWrap(node, maxWidth, useAdvancedWrap, multiline) {
  if (typeof node?.setWordWrapWidth !== 'function') return;
  if (!multiline || !Number.isFinite(maxWidth) || maxWidth <= 0) {
    node.setWordWrapWidth(0, false);
    return;
  }
  node.setWordWrapWidth(maxWidth, useAdvancedWrap);
}

function getWrappedLines(node) {
  const text = node?.text ?? '';
  if (typeof node?.getWrappedText === 'function') {
    try {
      const lines = node.getWrappedText(text);
      if (Array.isArray(lines) && lines.length > 0) return lines;
    } catch {}
  }
  return String(text).split('\n');
}

function nodeFits(node, { maxWidth, maxHeight, maxLines }) {
  if (!node) return true;
  const width = Number.isFinite(node.width) ? node.width : 0;
  const height = Number.isFinite(node.height) ? node.height : 0;
  const lines = getWrappedLines(node);

  if (Number.isFinite(maxWidth) && maxWidth > 0 && width > maxWidth + FIT_EPSILON) return false;
  if (Number.isFinite(maxHeight) && maxHeight > 0 && height > maxHeight + FIT_EPSILON) return false;
  if (Number.isFinite(maxLines) && maxLines > 0 && lines.length > maxLines) return false;
  return true;
}

function ellipsizeText(text, length, ellipsis = '...') {
  const normalized = normalizeTextValue(text);
  if (!normalized) return '';
  if (!Number.isFinite(length) || length <= 0) return ellipsis;
  if (normalized.length <= length) return normalized;
  const sliceLength = Math.max(0, length - ellipsis.length);
  return `${normalized.slice(0, sliceLength).trimEnd()}${ellipsis}`;
}

function fitTextNode(node, text, {
  mode = 'multi',
  maxWidth = null,
  maxHeight = null,
  maxLines = mode === 'single' ? 1 : null,
  minFontSize = 10,
  baseFontSize = null,
  useAdvancedWrap = true,
  ellipsis = '...',
} = {}) {
  if (!node) return '';

  const normalized = normalizeTextValue(text);
  const singleLine = mode === 'single';
  const resolvedBaseFont = ensureBaseFontSize(node, baseFontSize);
  const resolvedMinFont = Math.max(1, Math.min(resolvedBaseFont, Math.round(minFontSize)));

  setWordWrap(node, maxWidth, useAdvancedWrap, !singleLine);
  setNodeFontSize(node, resolvedBaseFont);
  node.setText(normalized);

  for (let size = resolvedBaseFont; size >= resolvedMinFont; size -= 1) {
    setNodeFontSize(node, size);
    node.setText(normalized);
    if (nodeFits(node, { maxWidth, maxHeight, maxLines })) {
      return normalized;
    }
  }

  let best = normalized ? ellipsis : '';
  let low = 0;
  let high = normalized.length;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = ellipsizeText(normalized, middle, ellipsis);
    node.setText(candidate);
    if (nodeFits(node, { maxWidth, maxHeight, maxLines })) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  node.setText(best);
  return best;
}

export function truncateText(text, maxChars, ellipsis = '...') {
  const normalized = normalizeTextValue(text);
  if (!Number.isFinite(maxChars) || maxChars <= 0) return normalized ? ellipsis : '';
  if (normalized.length <= maxChars) return normalized;
  return ellipsizeText(normalized, maxChars, ellipsis);
}

export function fitSingleLineText(node, text, options = {}) {
  return fitTextNode(node, text, {
    ...options,
    mode: 'single',
    maxLines: 1,
  });
}

export function fitParagraphText(node, text, options = {}) {
  return fitTextNode(node, text, {
    ...options,
    mode: 'multi',
  });
}

