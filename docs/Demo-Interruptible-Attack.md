# Demo: Interruptible Attack

This example demonstrates the three core mechanisms of Dual-World Theory:

- **Temporal Causal Sovereignty**: A temporary state window with a time limit
- **Interruptibility**: When a new event arrives, the old window is atomically revoked
- **Logic/Presentation Separation**: Damage determination is completely decoupled from animation playback

## Scenario

1. Player presses attack → Enters 2-second wind-up
2. Player presses dodge during wind-up → Attack canceled, no damage dealt
3. Wind-up completes → Deals 20 damage

## Analysis

1. Does this affect future causality? Yes, so it does not belong to the Presentation Layer.
2. Further analysis: can it be interrupted by future events? Yes, so it is not pure Local Causality.
3. Conclusion: a temporary window under Temporal Causal Sovereignty is needed to handle this attack and dodge event.

## Code

```typescript

// ============================================
// 1. Event definitions (the system's only input)
// ============================================
type Event =
  | { type: 'input:attack' }
  | { type: 'input:dodge' };

// ============================================
// 2. Logic World (Local Causality layer)
// ============================================
const logic = {
  casting: null as string | null,

  // Rule: Event → State change
  reduce(e: Event) {
    switch (e.type) {
      case 'input:attack': {
        // Grant new temporal sovereignty; old one is automatically preempted
        const id = timelord.grant(2000, () => {
          // Window ends normally: transaction committed
          this.casting = null;
          console.log('  [Logic] Attack hit, 20 damage dealt');
        }, () => {
          // Window interrupted: transaction rolled back
          this.casting = null;
          console.log('  [Logic] Attack interrupted, no damage');
        });
        this.casting = id;
        console.log('  [Logic] Attack wind-up started');
        break;
      }
      case 'input:dodge': {
        if (this.casting) {
          timelord.revoke(this.casting, 'abort');
        }
        console.log('  [Logic] Dodge');
        break;
      }
    }
  }
};

// ============================================
// 3. Temporal Sovereignty Manager (internal mechanism of Local Causality)
// ============================================
let _timelordId = 0;

const timelord = {
  active: null as { id: string; timer: any; commit: () => void; abort: () => void } | null,

  grant(ms: number, onCommit: () => void, onAbort: () => void) {
    if (this.active) this.revoke(this.active.id, 'abort');  // Preempt old sovereignty
    const id = `window_${++_timelordId}`;
    this.active = {
      id,
      commit: onCommit,
      abort: onAbort,
      timer: setTimeout(() => this.revoke(id, 'commit'), ms),
    };
    return id;
  },

  revoke(id: string, mode: 'commit' | 'abort') {
    if (!this.active || this.active.id !== id) return;
    clearTimeout(this.active.timer);
    const t = this.active;
    this.active = null;
    mode === 'commit' ? t.commit() : t.abort();
  }
};

// ============================================
// 4. Presentation World (Rendering component)
// ============================================
const renderer = {
  onEvent(e: Event) {
    switch (e.type) {
      case 'input:attack':
        console.log('  [Presentation] Playing attack wind-up animation ────────>');
        break;
      case 'input:dodge':
        console.log('  [Presentation] Playing dodge animation');
        break;
    }
  }
};

// ============================================
// 5. Event bus
// ============================================
function emit(e: Event) {
  logic.reduce(e);
  renderer.onEvent(e);
}

// ============================================
// 6. Run demo
// ============================================
console.log('Scenario: Attack interrupted by dodge after 1 second\n');

emit({ type: 'input:attack' });
setTimeout(() => emit({ type: 'input:dodge' }), 1000);
```

## Output

```
Scenario: Attack interrupted by dodge after 1 second

  [Logic] Attack wind-up started
  [Presentation] Playing attack wind-up animation ────────>
  [Logic] Attack interrupted, no damage
  [Logic] Dodge
  [Presentation] Playing dodge animation
```

## Mapping

| Code | Theory |
|------|--------|
| `Event` type | Input interface for **Game Causality** |
| `logic.reduce()` | Rule deduction in **Local Causality layer** |
| `timelord.grant/revoke` | Grant and preempt **Temporal Causal Sovereignty** |
| `renderer.onEvent()` | **Presentation World** (Perceptual Sovereignty) |
| `emit()` | Unidirectional data flow: logic drives presentation |

## Key Observations

### Interrupt is clean

```typescript
timelord.revoke(this.casting, 'abort');
// → onAbort executes: casting = null, "no damage"
```

After the old window is revoked, damage is not produced, and no residual state needs manual cleanup.

### Logic and presentation are naturally separated

- `[Logic] Attack interrupted, no damage` — Triggered by `timelord`'s `onAbort`
- `[Presentation] Playing dodge animation` — Triggered by `input:dodge` event

Changing the animation will not affect damage determination; changing damage values will not affect animation playback.