#!/usr/bin/env node
/**
 * games/sts/tools/dev-events.js — print the static STS event chain
 */
import archy from 'archy';
import { ALL_STATUS_MODULES } from '../src/content/statuses/core.js';
import { ALL_RULES } from '../src/rules/index.js';
import { EVENTS } from '../src/module.js';
import { Registry } from '../../../packages/core/src/Registry.js';

function getEventHooks(def) {
  // Reconstruct hooks from def using Registry's internal normalization.
  // Since hooks.js was merged into Registry, we use a lightweight re-implementation
  // here to avoid instantiating a full Registry.
  const hooks = [];
  const map = def?.hooks;
  if (!map) return hooks;
  for (const [key, raw] of Object.entries(map)) {
    if (!key.startsWith('event:')) continue;
    const name = key.slice('event:'.length);
    if (!name) continue;
    let script, order = 0;
    if (typeof raw === 'string') { script = raw; }
    else if (raw && typeof raw === 'object') { script = raw.script; order = raw.order ?? 0; }
    else { continue; }
    if (typeof script !== 'string') continue;
    hooks.push({ name, order, script });
  }
  return hooks;
}

function extractEmits(script) {
  const found = new Map();
  const withPayload = /State\.emit\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]*)\}/gs;
  const emptyPayload = /State\.emit\(\s*['"]([^'"]+)['"]\s*,\s*\{\s*\}/g;
  let match;

  while ((match = withPayload.exec(script)) !== null) {
    const event = match[1];
    const typeId = match[2].match(/typeId\s*=\s*['"]([^'"]+)['"]/);
    const label = typeId ? `${event}[${typeId[1]}]` : event;
    if (!found.has(label)) found.set(label, label);
  }

  while ((match = emptyPayload.exec(script)) !== null) {
    if (!found.has(match[1])) found.set(match[1], match[1]);
  }

  return [...found.values()];
}

const map = new Map();
for (const event of Object.keys(EVENTS)) map.set(event, []);

function addTriggers(def) {
  for (const trigger of getEventHooks(def)) {
    const bucket = map.get(trigger.name);
    if (!bucket) continue;
    bucket.push({
      registeredBy: def.id,
      order: trigger.order ?? 0,
      emits: extractEmits(trigger.script),
    });
  }
}

for (const rule of ALL_RULES) addTriggers(rule);
for (const def of ALL_STATUS_MODULES) addTriggers(def);
for (const handlers of map.values()) handlers.sort((left, right) => right.order - left.order);

const emittedByHandlers = new Set();
for (const handlers of map.values()) {
  for (const handler of handlers) {
    for (const label of handler.emits) emittedByHandlers.add(label.replace(/\[.*\]$/, ''));
  }
}

const pad = value => String(value >= 0 ? `+${value}` : value).padStart(5);
const shown = new Set();
const shownEvents = new Set();

function buildNode(emitLabel, visited = new Set()) {
  const event = emitLabel.replace(/\[.*\]$/, '');
  const handlers = map.get(event) ?? [];

  if (shown.has(emitLabel)) return emitLabel;
  shown.add(emitLabel);
  shownEvents.add(event);

  const isRoot = !emittedByHandlers.has(event);
  const label = isRoot ? `${emitLabel}  [entry]` : emitLabel;
  const nextVisited = new Set([...visited, event]);

  const nodes = handlers.map(handler => {
    const handlerLabel = `[${pad(handler.order)}]  ${handler.registeredBy}`;
    if (!handler.emits.length) return handlerLabel;

    const children = handler.emits.map(child => {
      if (nextVisited.has(child.replace(/\[.*\]$/, ''))) return `${child}  (circular)`;
      const node = buildNode(child, nextVisited);
      return typeof node === 'string' ? `${child}  (see above)` : node;
    });
    return { label: handlerLabel, nodes: children };
  });

  return { label, nodes };
}

const totalHandlers = [...map.values()].reduce((sum, handlers) => sum + handlers.length, 0);
process.stdout.write('\nCobweb Event Chain\n');
process.stdout.write(`${map.size} events, ${totalHandlers} handlers\n\n`);

const roots = [...map.keys()].filter(
  event => !emittedByHandlers.has(event) && (map.get(event)?.length ?? 0) > 0,
);
for (const root of roots) process.stdout.write(archy(buildNode(root)));

for (const [event, handlers] of map) {
  if (shownEvents.has(event) || !handlers.length) continue;
  process.stdout.write(archy(buildNode(event)));
}
