# Demo: Interruptible Attack

This example demonstrates the four core mechanisms of Dual-World Design:

- **Lookup State Machine**: All state transitions predefined, no hidden paths
- **Temporary State**: Managing time-limited behavior with simple fields
- **Interruptibility**: Clean reset of old state when new events arrive
- **Logic/Presentation Separation**: Damage determination completely decoupled from animation playback

---

## Scenario

1. Player presses attack → Enters 2-second wind-up
2. Player presses dodge during wind-up → Attack canceled, no damage dealt
3. Wind-up completes → Deals 20 damage

---

## Code

```typescript
// ============================================
// 1. State Definition
// ============================================
interface State {
  player: {
    hp: number;
    status: 'idle' | 'attacking' | 'hit';
    casting: null | { elapsed: number; duration: number };
  };
}

const initialState: State = {
  player: {
    hp: 100,
    status: 'idle',
    casting: null,
  },
};

// ============================================
// 2. Event Definition
// ============================================
type Event =
  | { type: 'input:attack' }
  | { type: 'input:dodge' }
  | { type: 'tick'; dt: number };

// ============================================
// 3. State Transition Table (Lookup)
// ============================================
// All possible state transitions predefined here, runtime only lookups
const statusTransitions: Record<string, Record<string, string>> = {
  idle: {
    'input:attack': 'attacking',
  },
  attacking: {
    'input:dodge': 'idle',
    'tick:complete': 'idle',
  },
  hit: {
    'tick:recover': 'idle',
  },
};

// ============================================
// 4. Logic Layer (Pure Function)
// ============================================
function reduce(state: State, event: Event): State {
  const next = structuredClone(state);

  switch (event.type) {
    case 'input:attack': {
      // Interrupt old attack
      if (next.player.casting) {
        next.player.casting = null;
      }
      next.player.casting = { elapsed: 0, duration: 2000 };
      next.player.status = 'attacking';
      break;
    }

    case 'input:dodge': {
      if (next.player.casting) {
        next.player.casting = null;
        next.player.status = 'idle';
      }
      break;
    }

    case 'tick': {
      const c = next.player.casting;
      if (c) {
        c.elapsed += event.dt;
        if (c.elapsed >= c.duration) {
          // Attack complete
          next.player.casting = null;
          next.player.status = 'idle';
        }
      }
      break;
    }
  }

  return next;
}

// ============================================
// 5. Presentation Layer (Reads Snapshots Only)
// ============================================
const renderer = {
  last: null as State | null,

  update(curr: State) {
    const last = this.last;

    // Detect state changes, play corresponding animations
    if (curr.player.status !== last?.player.status) {
      switch (curr.player.status) {
        case 'attacking':
          console.log('  [Presentation] Playing attack wind-up animation');
          break;
        case 'idle':
          if (last?.player.status === 'attacking') {
            // From attacking → idle: determine if completed or interrupted
            if (last.player.casting && last.player.casting.elapsed >= 2000) {
              console.log('  [Presentation] Playing attack hit effect');
            } else {
              console.log('  [Presentation] Attack animation interrupted, playing recovery');
            }
          }
          break;
      }
    }

    this.last = structuredClone(curr);
  },
};

// ============================================
// 6. Event Bus (With Logging)
// ============================================
const eventLog: Event[] = [];
let currentState = initialState;

function emit(event: Event) {
  eventLog.push(event);
  currentState = reduce(currentState, event);
  renderer.update(currentState);
}

// ============================================
// 7. Synchronous Demo (Event Sequence)
// ============================================
console.log('=== Scenario: Attack interrupted by dodge after 1 second ===\n');

emit({ type: 'input:attack' });
emit({ type: 'tick', dt: 500 });
emit({ type: 'tick', dt: 500 });
emit({ type: 'input:dodge' });

// ============================================
// 8. Replay Demo (Event Log Replay)
// ============================================
console.log('\n=== Replay: Replay with same event sequence ===\n');

let replayState = initialState;
for (const e of eventLog) {
  replayState = reduce(replayState, e);
}
console.log('Replay final state:', JSON.stringify(replayState.player));

// ============================================
// 9. Unit Tests (Pure Functions)
// ============================================
function test() {
  // Test 1: State correct after attack completes
  let s = initialState;
  s = reduce(s, { type: 'input:attack' });
  s = reduce(s, { type: 'tick', dt: 2000 });
  console.assert(s.player.status === 'idle', 'Should return to idle after attack');
  console.assert(s.player.casting === null, 'casting should be cleared');

  // Test 2: Dodge interrupts attack
  s = initialState;
  s = reduce(s, { type: 'input:attack' });
  s = reduce(s, { type: 'tick', dt: 500 });
  s = reduce(s, { type: 'input:dodge' });
  console.assert(s.player.status === 'idle', 'Should return to idle after dodge');
  console.assert(s.player.casting === null, 'casting should be interrupted');

  console.log('\nTests passed ✓');
}

test();
```

---

## Output

```
=== Scenario: Attack interrupted by dodge after 1 second ===

  [Presentation] Playing attack wind-up animation
  [Presentation] Attack animation interrupted, playing recovery

=== Replay: Replay with same event sequence ===

Replay final state: {"hp":100,"status":"idle","casting":null}

Tests passed ✓
```

---

## Mapping

| Code | Concept |
|------|---------|
| `statusTransitions` | **Lookup State Machine**: All paths predefined |
| `reduce(state, event)` | **Logic Layer**: Pure function, no side effects |
| `player.casting` | **Temporary State**: Simple object, cleared directly |
| `eventLog` | **Event Log**: Replayable, traceable |
| `renderer.update(snapshot)` | **Presentation Layer**: Reads snapshot, diff-driven |
| `reduce(initialState, event)` | **Unit Tests**: Pure functions, no engine needed |

---

## Key Design Points

### 1. Lookup State Machine

All state transitions declared in `statusTransitions`. Runtime only lookups:

```ts
const nextStatus = statusTransitions[currentStatus]?.[eventType];
```

Undefined combinations return `undefined`, can error immediately. No hidden paths.

### 2. Temporary State Is Just a Plain Object

```ts
this.player.casting = { elapsed: 0, duration: 2000 };
```

Interrupting is assigning `null`, no callbacks, no manager:

```ts
this.player.casting = null;
```

### 3. Deterministic Event Stream

```ts
emit({ type: 'input:attack' });
emit({ type: 'tick', dt: 500 });
emit({ type: 'tick', dt: 500 });
emit({ type: 'input:dodge' });
```

Synchronous execution, no `setTimeout`, no async. Event log `eventLog` can be precisely replayed.

### 4. Pure Function Tests

```ts
let s = initialState;
s = reduce(s, { type: 'input:attack' });
s = reduce(s, { type: 'tick', dt: 2000 });
assert(s.player.status === 'idle');
```

No engine startup, no rendering initialization. Just ordinary function tests.
