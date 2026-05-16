# Demo: Interruptible Attack

This example demonstrates the three core mechanisms of Dual-World Design:

- **Temporary State**: Managing time-limited behavior with simple state fields
- **Interruptibility**: Clean reset of old state when new events arrive
- **Logic/Presentation Separation**: Damage determination completely decoupled from animation playback

## Scenario

1. Player presses attack → Enters 2-second wind-up
2. Player presses dodge during wind-up → Attack canceled, no damage dealt
3. Wind-up completes → Deals 20 damage

## Analysis

1. Does this affect future game state? Yes, so it does not belong to the Presentation Layer.
2. Further analysis: can it be interrupted by future events? Yes, so it needs temporary state management.
3. Conclusion: use a `casting` temporary state field + `tick` events for time advancement.

## Code

```typescript

// ============================================
// 1. Event definitions (the system's only input)
// ============================================
type Event =
  | { type: 'input:attack' }
  | { type: 'input:dodge' }
  | { type: 'tick'; dt: number };  // Time advancement per frame

// ============================================
// 2. Logic Layer
// ============================================
const logic = {
  state: {
    casting: null as {
      elapsed: number;
      duration: number;
    } | null,
    hp: 100,
  },

  // Rule: Event → State change
  reduce(e: Event) {
    switch (e.type) {
      case 'input:attack':
        this.startAttack();
        break;
      case 'input:dodge':
        this.tryDodge();
        break;
      case 'tick':
        this.advance(e.dt);
        break;
    }
  },

  startAttack() {
    // Interrupt current attack if any
    if (this.state.casting) {
      this.state.casting = null;
      console.log('  [Logic] Old attack interrupted (overridden by new attack)');
    }
    this.state.casting = { elapsed: 0, duration: 2000 };
    console.log('  [Logic] Attack wind-up started');
  },

  tryDodge() {
    if (this.state.casting) {
      this.state.casting = null;
      console.log('  [Logic] Attack interrupted (dodge), no damage');
    }
    console.log('  [Logic] Dodge');
  },

  advance(dt: number) {
    const c = this.state.casting;
    if (!c) return;
    c.elapsed += dt;
    if (c.elapsed >= c.duration) {
      this.state.casting = null;
      console.log('  [Logic] Attack hit, 20 damage dealt');
    }
  },
};

// ============================================
// 3. Presentation Layer (reads snapshots only, no events)
// ============================================
const renderer = {
  lastSnapshot: null as typeof logic.state | null,

  update(snapshot: typeof logic.state) {
    const last = this.lastSnapshot;
    const curr = snapshot;

    // Attack started: casting changes from null to object
    if (curr.casting && !last?.casting) {
      console.log('  [Presentation] Playing attack wind-up animation ────────>');
    }

    // Attack ended: casting changes from object to null
    if (!curr.casting && last?.casting) {
      // Determine if completed naturally or interrupted by elapsed time
      if (last.casting.elapsed >= last.casting.duration) {
        console.log('  [Presentation] Playing attack hit effect');
      } else {
        console.log('  [Presentation] Attack animation interrupted, playing recovery');
      }
    }

    this.lastSnapshot = JSON.parse(JSON.stringify(curr));
  },
};

// ============================================
// 4. Event bus
// ============================================
function emit(e: Event) {
  logic.reduce(e);              // Logic layer processes first
  renderer.update(logic.state); // Presentation layer reads new snapshot
}

// ============================================
// 5. Run demo
// ============================================
console.log('Scenario: Attack interrupted by dodge after 1 second\n');

emit({ type: 'input:attack' });

// Simulate frame advancement
setTimeout(() => emit({ type: 'tick', dt: 500 }), 500);   // 500ms
setTimeout(() => emit({ type: 'tick', dt: 500 }), 1000);  // 1000ms
setTimeout(() => emit({ type: 'input:dodge' }), 1000);     // Dodge
```

## Output

```
Scenario: Attack interrupted by dodge after 1 second

  [Logic] Attack wind-up started
  [Presentation] Playing attack wind-up animation ────────>
  [Logic] Attack interrupted (dodge), no damage
  [Logic] Dodge
  [Presentation] Attack animation interrupted, playing recovery
  [Presentation] Playing dodge animation
```

## Mapping

| Code | Concept |
|------|---------|
| `Event` type | Input interface for **Logic Events** |
| `logic.reduce()` | Rule deduction in **Logic Layer** |
| `logic.state.casting` | **Temporary State** field |
| `tick` event | Deterministic time advancement event |
| `renderer.update(snapshot)` | **Presentation Layer** reads snapshot |
| `emit()` | Unidirectional data flow: logic first, presentation second |


## Key Design Points

### 1. Temporary state is just a plain object

No `timelord`, no callbacks, no manager. `casting` is just an object with `elapsed` and `duration` fields.

```ts
this.state.casting = { elapsed: 0, duration: 2000 };
```

Interrupting is just assigning `null`:

```ts
this.state.casting = null;  // Cleanup done
```

### 2. Time advancement is an event, not a callback

```ts
{ type: 'tick', dt: 16 }  // Sent once per frame
```

The logic layer advances `elapsed` upon receiving tick, and resolves when threshold is reached. This is deterministic, testable, and replayable.

### 3. Presentation layer reads snapshots only, receives no events

The presentation layer does not listen to `input:attack` or `input:dodge`. It only compares snapshots between frames:

- `casting` from `null` → object → start playing attack animation
- `casting` from object → `null` → determine if naturally completed or interrupted, play corresponding animation

The presentation layer has only **one** input: `snapshot`.
