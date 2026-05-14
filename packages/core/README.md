# `@netweave/core`

Logic-first gameplay runtime for event-driven games.

This package intentionally only contains the generic runtime layer:

- state tree and snapshots
- event pipelines and ordered handlers
- transactional execution and rollback
- dynamic `bind` / `unbind`
- Lua script runtime (sandboxed)

It does not include any concrete game rules. STS-style battle flow and other
game-specific code live in examples.

## Public API

```js
import { createEngine } from '@netweave/core';
```

`createEngine()` returns `{ use, load, getState, state, close }`.

`state` exposes the five primitives shared by JS and Lua:

| Method | Description |
|--------|-------------|
| `state.get(...parts)` | Read a value from the state tree |
| `state.set(...partsAndValue)` | Write a value (or `null` to delete) |
| `state.emit(event, payload)` | Fire an event synchronously |
| `state.bind({ key, kind, id, ctx, slot })` | Dynamically attach a def's hooks |
| `state.unbind(key)` | Remove a dynamic binding |

## Concept boundaries

- `engine.use(module)` means install a gameplay module during assembly time. It is not a runtime gameplay command.
- repeated `engine.use(...)` calls are compositional: module defs/rules/events are accumulated, and context conventions are merged.
- `snapshot` means a full serializable state returned by `getState()` and accepted by `load()`.
- `phase` is purely game-layer state (e.g. a string like `battle` or `reward`). Core has no phase concept; `State.set('phase', ...)` is an ordinary state write.
- concrete phase vocabularies, lifecycle rules, and transition side-effects remain entirely in game-layer code.
- `engine.close()` releases the runtime when the engine is no longer needed.

## Minimal example

```js
import { createEngine } from '@netweave/core';

const engine = await createEngine();

engine.use({
  events: {
    'counter:add': { action: 'COUNTER_ADD' },
  },
  rules: [{
    id: 'core:counter:add',
    hooks: {
      'event:counter:add': `
local current = State.get('count') or 0
State.set('count', current + (Event.amount or 1))
`,
    },
  }],
});

engine.load({ count: 0 });
engine.state.emit('counter:add', { amount: 2 });

console.log(engine.getState());
```


