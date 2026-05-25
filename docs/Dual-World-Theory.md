# Dual-World Design

![Dual-World Architecture](../asset/dual_world_architecture_en.svg)

---

## Two Kinds of State Changes

There exist two fundamentally different kinds of state changes in games.

The first is **Core State**. HP reduction, equipment acquisition, level progression—these events alter the future of the game by changing the game state. They are permanent writes to the world state. It consists of two parts:
- **Instant Resolution**: Local pure-function computation, like a database transaction that instantly completes numerical updates. It is discrete, instantaneous, irreversible, and **absolutely serial** (similar to the single-threaded event-driven model of frontend JavaScript, where "simultaneity" in the physical world is forcibly queued).
- **Process Resolution**: An asynchronous container with a lifecycle (time sandbox), mounted on the Update time stream, used to digest time-consuming processes (such as a 3-second charge-up). At the instant this 3-second "process" ends, it submits an "instant resolution" instruction to the resolver.

The second is **Visual Presentation**. Sword-swing animations, chase movements, particle effects—these state evolutions do not affect any future game state. They serve the present experience and vanish when ended. Unlike the "absolute seriality" of Logic State, Visual Effects are **continuous and parallel**. Because they hold and produce no state facts, there is naturally no state-write contention. Therefore, a scene can have countless animations, sound effects, and particle systems truly functioning "simultaneously." Discrete events forcibly queued within the same frame in the logic engine can elegantly unfold in the presentation layer as multi-track parallel visual presentations.

These two kinds of state changes operate on different axes (logic is discrete/serial, presentation is continuous/parallel) and are orthogonal in nature. The entirety of Dual-World Design proceeds from this distinction.

---

## State Layering

Based on this distinction, the system's state naturally divides into three layers:

```
Persistent State  →  Cross-scene Save (permanent, cross-scene)
Logic Layer       →  Scene State (born and dies with the scene)
Presentation Layer → Rendering Component Tree (disposable, holds no state)
```

**Persistent State** is the save layer. It only records state facts that need to cross scene boundaries, and does not participate in local rule computation.

**Logic Layer** is the state deduction center for the current scene. All state changes within the scene happen here. When the scene ends, important data is written back to Persistent State, and local state is destroyed entirely.

**Presentation Layer** is the rendering component tree. It reads the output of the Logic Layer and presents discrete state changes as continuous experiences. It holds no persistent state, but it is not passive—this is the key to understanding Dual-World Design.

---

## Rendering Component Autonomy

Rendering components are not mere visual units; they are **the extension of frontend component autonomy into games**.

When a monster component mounts, it means that monster exists in the world. Its `update(dt)` can run complete behavioral logic: detecting player distance, deciding to chase, executing attack wind-up. When the component unmounts, the monster disappears. **The lifecycle itself is the carrier of behavior.**

Everything inside a component—state, animation, time-related behavior—is autonomous by default. Chase trajectories, attack animation frame scheduling, and in-range trigger detection all run inside the component without consulting any upper layer.

Only when behavior **touches the Logic Layer** does it report upward as an event:

```
Autonomous Within Component (no report)    Touches Logic Layer (report event)
─────────────────────────────────────     ─────────────────────────────────────
Chase movement                              Hit determination
Attack animation scheduling                 HP reduction
Range detection                             Death
Wind-up / recovery                          Pickup trigger
```

This autonomy boundary makes rendering components truly independent units—composable, nestable, and individually testable. The complexity of the entire component tree can be freely decomposed without compromising the cleanliness of the Logic Layer.

---

## Temporary States

Continuous games raise a deeper question: ACT combo windows, parry frames, real-time physics simulation—these continuously produce states over a sustained duration. They are not the result of a single event trigger, but they are real state facts that affect future deduction. Where do they belong?

This requires a mechanism for **Temporary States**.

**Temporary States are the asynchronous input channels of the Logic Layer**: they run continuously within a time window and submit a conclusion to the Reducer when the window ends. This is the only way the Logic Layer digests "time-consuming processes." The "Process Resolution" mentioned above is implemented via Temporary State windows.

From an engineering perspective, this can be viewed as **structured concurrency**.

Temporary States belong to the Logic Layer, not to rendering components. Parry frames and combo windows are internal states of the Logic Layer, managed under Temporary States. If placed in rendering components, interruptions would trigger race conditions. Therefore, they must be managed through layered governance: interruption and revocation must merely be a clean state reset in the Logic Layer. The rendering component is only responsible for receiving new instructions and never participates in making logic adjudications.

Temporary States have three core properties:

- **Time-bounded**: Temporary state exists within a time window; when the window closes, the state naturally expires.
- **Revocable**: When an upper-layer event arrives, the temporary state can be immediately preempted and reset.
- **Sandboxed**: The temporary window only produces conclusions, not processes. Process states naturally perish when the window closes; conclusions are uniformly written back after being adjudicated by the Logic Layer.

---

## Deterministic Structure

Temporary windows within the Logic Layer can be interrupted by upper layers at any time.

When the player presses dodge, the Logic Layer determines whether the current state is uninterruptible (certain hard-recovery frames), and then decides whether to execute dodge rules. If executed, local state is reset and rendering components receive new state commands. The discarded animation frames were never state facts to begin with; nothing is damaged.

In a declarative state machine, interruption is a forced transition:

```
animating ──interrupt──> idle
```

When the presentation layer state is forcibly switched, rendering components must gracefully self-interrupt—the current animation cleanly finishes, then cuts to the new state, leaving no visual mess. This edge is explicitly declared in the state graph; the transition is simply checking whether this edge exists—completely deterministic.

The system does not pursue deterministic *outcomes*, but **deterministic *structure***. Whether dodge succeeds is uncertain, but all possible outcomes are pre-enumerated, and every exit has a defined connection. What is uncertain is only which path is taken—not whether the path exists at all.

---

## Boundary Judgment

When the three-layer structure lands in practice, it always returns to the same question:

**Does this change the game state?**

View side-effects that only provide visual feedback without producing write operations belong to rendering components: autonomous by default, disposable at any time. Those that trigger write operations but are only valid within the current scene (temporary combat sandbox, current local data) belong to the Logic Layer: born and dies with the scene. Core trusted data that affects cross-scene cycles belongs to Persistent State and must be persisted to disk.
