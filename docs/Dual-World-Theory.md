# Dual-World Theory

---

## Two Kinds of Causality

There exist two fundamentally different kinds of causality in games.

The first is **Game Causality**. HP reduction, equipment acquisition, level progression—these events alter the future of the game. They are permanent writes to the world state. They are discrete, instantaneous, and irreversible.

The second is **Perceptual Causality**. Sword-swing animations, chase movements, particle effects—these state evolutions do not affect any future game deduction. They serve the present experience and vanish when ended.

These two causalities operate on different axes and are orthogonal in nature. The entirety of Dual-World Theory proceeds from this distinction.

---

## Three Layers of Sovereignty

Based on this distinction, the causal power of the system naturally divides into three layers:

```
World Causality Tree  →  Ultimate Causal Sovereignty (permanent, cross-scene)
Local Causality       →  Delegated Sovereignty (born and dies with the scene)
Presentation Runtime  →  Perceptual Sovereignty (disposable, holds no causal facts)
```

**World Causality Tree** is the persistence layer. It only records causal facts that need to cross scene boundaries. It does not participate in local rule computation, but always retains ultimate preemptive power over lower layers.

**Local Causality** is the delegated sovereignty granted by the World Causality Tree to the current scene. All state deduction within the scene happens here. When the scene ends, important conclusions are written back to the World Causality Tree, and local state is destroyed entirely.

**Presentation Runtime** is the rendering component tree. It reads the output of Local Causality and presents discrete state changes as continuous experiences. It holds no persistent causal power, but it is not passive—this is the key to understanding Dual-World Theory.

---

## Rendering Component Autonomy

Rendering components are not mere visual units; they are **the extension of frontend component autonomy into games**.

When a monster component mounts, it means that monster exists in the world. Its `update(dt)` can run complete behavioral logic: detecting player distance, deciding to chase, executing attack wind-up. When the component unmounts, the monster disappears. **The lifecycle itself is the carrier of behavior.**

Everything inside a component—state, animation, time-related behavior—is autonomous by default. Chase trajectories, attack animation frame scheduling, and in-range trigger detection all run inside the component without consulting any upper layer.

Only when behavior **touches Local Causality** does it report upward as an event:

```
Autonomous Within Component (no report)    Touches Local Causality (report event)
─────────────────────────────────────     ─────────────────────────────────────
Chase movement                              Hit determination
Attack animation scheduling                 HP reduction
Range detection                             Death
Wind-up / recovery                          Pickup trigger
```

This autonomy boundary makes rendering components truly independent units—composable, nestable, and individually testable. The complexity of the entire component tree can be freely decomposed without compromising the cleanliness of the Local Causality layer.

---

## Temporal Causal Sovereignty

Continuous games raise a deeper question: ACT combo windows, parry frames, real-time physics simulation—these continuously produce states over a sustained duration. They are not the result of a single event trigger, but they are real causal facts that affect future deduction. Where do they belong?

This requires a new concept: **Temporal Causal Sovereignty**.

**Temporal Causal Sovereignty is the complete autonomy over local temporary states that Local Causality holds within a time window.** It allows Local Causality to continuously read and write temporary states, execute frame-level rules, and run physics simulation within this window. parry frames and combo windows are internal states of Local Causality; they operate under the jurisdiction of Temporal Causal Sovereignty, and should not belong to rendering components—if placed in rendering components, interruption would trigger race conditions. They must be managed through layered governance so that interruption and revocation are merely clean local state resets.

Temporal Causal Sovereignty has three core properties:

- **Time-bounded**: Sovereignty exists within a time window; when the window closes, sovereignty naturally expires.
- **Revocable**: When an upper-layer event arrives, sovereignty can be immediately preempted and local state reset.
- **Sandboxed**: States within the sovereignty scope are temporary and cannot be written to the World Causality Tree.

---

## Deterministic Structure

Delegated sovereignty can be interrupted by upper layers at any time.

When the player presses dodge, Local Causality determines whether the current state is uninterruptible (certain hard-recovery frames), and then decides whether to execute dodge rules. If executed, local state is reset and rendering components receive new state commands. The discarded animation frames were never causal facts to begin with; nothing is damaged.

In a declarative state machine, interruption is a forced transition:

```
animating ──interrupt──> idle
```

This edge is explicitly declared in the state graph; the transition is simply checking whether this edge exists—completely deterministic.

The system does not pursue deterministic *outcomes*, but **deterministic *structure***. Whether dodge succeeds is uncertain, but all possible outcomes are pre-enumerated, and every exit has a defined connection. What is uncertain is only which path is taken—not whether the path exists at all.

---

## Golden Standard

When the three-layer structure lands in practice, it always returns to the same question:

**Does this affect future causal deduction?**

If not, it belongs to rendering components: autonomous by default, disposable. If it affects deduction but is only valid within the current scene, it belongs to Local Causality: born and dies with the scene. If it affects cross-scene deduction, it belongs to the World Causality Tree and must be persisted.
