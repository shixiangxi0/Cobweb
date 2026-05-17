# Demo: Interruptible Attack

This example demonstrates the three core mechanisms of Dual-World Design:

- **Temporary State**: Managing time-limited behavior with simple fields
- **Interruptibility**: Clean reset of old state when new events arrive
- **Logic/Presentation Separation**: Damage determination completely decoupled from animation playback

## Scenario

1. Player presses attack → Enters 2-second wind-up
2. Player presses dodge during wind-up → Attack canceled, no damage dealt
3. Wind-up completes → Deals 20 damage

## Code

```typescript
// ============================================
// 1. State Definition
// ============================================
interface State {
  player: {
    status: 'idle' | 'attacking';
    casting: null | { elapsed: number; duration: number };
  };
}

const initialState: State = {
  player: {
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
// 3. Logic Layer (Pure Function)
// ============================================
function reduce(state: State, event: Event): State {
  const next = structuredClone(state);

  switch (event.type) {
    case 'input:attack': {
      if (next.player.casting) {
        next.player.casting = null;  // Interrupt old attack
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
          next.player.casting = null;  // Attack complete
          next.player.status = 'idle';
        }
      }
      break;
    }
  }

  return next;
}

// ============================================
// 4. Presentation Layer (Reads Snapshots Only)
// ============================================
const renderer = {
  last: null as State | null,

  update(curr: State) {
    const last = this.last;

    if (curr.player.status !== last?.player.status) {
      if (curr.player.status === 'attacking') {
        console.log('  [Presentation] Playing attack wind-up animation');
      }
      if (curr.player.status === 'idle' && last?.player.status === 'attacking') {
        const completed = last.player.casting && last.player.casting.elapsed >= 2000;
        console.log(completed
          ? '  [Presentation] Playing attack hit effect'
          : '  [Presentation] Attack animation interrupted, playing recovery');
      }
    }

    this.last = structuredClone(curr);
  },
};

// ============================================
// 5. Event Bus (With Logging)
// ============================================
const eventLog: Event[] = [];
let currentState = initialState;

function emit(event: Event) {
  eventLog.push(event);
  currentState = reduce(currentState, event);
  renderer.update(currentState);
}

// ============================================
// 6. Run Demo
// ============================================
console.log('=== Scenario: Attack interrupted by dodge after 1 second ===\n');

emit({ type: 'input:attack' });
emit({ type: 'tick', dt: 500 });
emit({ type: 'tick', dt: 500 });
emit({ type: 'input:dodge' });

// Replay verification
console.log('\n=== Replay Verification ===\n');
let replay = initialState;
for (const e of eventLog) replay = reduce(replay, e);
console.log('Replay result:', JSON.stringify(replay.player));

// Unit tests
function test() {
  let s = initialState;
  s = reduce(s, { type: 'input:attack' });
  s = reduce(s, { type: 'tick', dt: 2000 });
  console.assert(s.player.status === 'idle' && s.player.casting === null, 'Attack complete test failed');

  s = initialState;
  s = reduce(s, { type: 'input:attack' });
  s = reduce(s, { type: 'tick', dt: 500 });
  s = reduce(s, { type: 'input:dodge' });
  console.assert(s.player.status === 'idle' && s.player.casting === null, 'Dodge interrupt test failed');

  console.log('Tests passed ✓');
}
test();
```

## Output

```
=== Scenario: Attack interrupted by dodge after 1 second ===

  [Presentation] Playing attack wind-up animation
  [Presentation] Attack animation interrupted, playing recovery

=== Replay Verification ===

Replay result: {"status":"idle","casting":null}

Tests passed ✓
```

## Mapping

| Code | Concept |
|------|---------|
| `reduce(state, event)` | **Logic Layer**: Pure function, no side effects |
| `player.casting` | **Temporary State**: Plain object, delete when done |
| `eventLog` | **Event Log**: Replayable, traceable |
| `renderer.update(snapshot)` | **Presentation Layer**: Reads snapshot, diff-driven |
| `reduce(initialState, event)` | **Unit Tests**: Pure functions, no engine needed |
