# How to Understand Dual-World Design

This document aims to provide an "architecture reference" to help developers familiar with modern software engineering build intuition for the Dual-World architecture.

---

## 1. Events and State: The Game Mapping of Event Sourcing and CQRS

Traditional game engines are mostly "State-Driven," treating in-memory variables as the truth of the world. In Dual-World Design, **"events are the facts, and state is merely a projection."**

This corresponds to **Event Sourcing** and **Command Query Responsibility Segregation (CQRS)** in serious software engineering:

* **Logic Events (Event / Write Model)**: Player button presses, collision-triggered damage—these are absolutely immutable "event facts" of the system. The logic engine is an absolutely serial processing pipeline, computing and accumulating core state through one-way reduction (Reduce) of these events.
* **Visual Effects (Projection / Read Model)**: Animations, effects, and particles in the presentation layer are essentially "read/projection models" derived by the engine from the event stream. They are separated onto another axis, dedicated to optimizing continuous audio-visual feedback for humans. Because they are merely projections, they can naturally be erased at any time and recalculated based on events.

---

## 2. State Layering: Borrow Checker and Scope

The three layers of Dual-World Design are structurally isomorphic to Rust's ownership model:

* **Persistent State (unique mutable borrow `&mut T`)**
  The core state tree is held with write permission by the logic layer at all times; all state evolution is strictly serial. This is not a convention but a structural constraint—races cannot occur at the architectural level, for the same reason Rust does not allow two `&mut T` to exist simultaneously.

* **Logic Layer (Scope of `&mut T`)**
  Persistent State delegates power to the current scene; all state deduction within the scene happens in the Logic Layer. When the scene ends, the delegation is revoked and local state is destroyed entirely—completely corresponding to Rust's mechanism where variables are automatically dropped when they leave scope.

* **Presentation Layer (immutable borrow `&T`)**
  The presentation layer only holds read permission for logic snapshots. How long an animation plays, whether it is forcibly interrupted, or even if the entire rendering layer crashes—none of these can affect the logic state in reverse. Multiple rendering components can read the same snapshot simultaneously, for the same reason Rust allows multiple `&T` to exist: read-only does not produce contention.

* **Temporary States (lifetime `'a`)**
  The Logic Layer creates temporary states to handle continuous states (such as parry frames and combo windows). When the window closes or is preempted by an upper layer, temporary states are directly destroyed without manual cleanup and leave no residue. This is structurally analogous to Rust's lifetimes, with one key difference: Rust lifetimes are statically determined at compile time, while Temporary State windows are dynamically granted and revoked at runtime.

---

## 3. Rendering Autonomy: Unidirectional Data Flow and UI Local State

"Rendering components hold presentation but not logic"—at first this sounds like a paradox: if a monster component can judge distance and run toward the player on its own, how can it have no business logic?

To understand the subtlety of this isolation, consider **modern frontend component governance design (such as the React + Redux/Flux paradigm)**:

* **Local State of Presentation Components (Local Simulation Autonomy)**:
  In frontend architecture, we would never put "the intermediate value of a dropdown expansion animation" or "a button's hover gradient" into an application-level Redux Store. By the same token, rendering components can internally maintain highly complex physical displacement simulations and pathfinding interpolation (this is their Local UI State) to ensure screen responsiveness. But these computations are strictly confined to the visual presentation layer and do not serve as the truth of the world.
* **Core Validation via Global Store (Unidirectional Data Flow)**:
  No matter what a rendering component independently calculates internally, as long as it does not throw (Dispatch) a key event upward, it will not affect the state direction of the business. Only when the rendering component detects and confirms substantive contact does it fire a discrete safe payload (Event Payload) to the Logic Layer.

This separation of powers isolates high-frequency, continuous, noise-filled "perceptual simulation" at the periphery, ensuring the purity of the core engine (resolver) and the absolute determinism of deduction.

> ⚠️ Generally, developers first encountering the Dual-World architecture tend to treat all player input as processing from the presentation layer to the Logic Layer. This is wrong. You must map each player input to its associated three-layer structure at the design stage: if it belongs to rendering components, it is autonomous by default and disposable. If it affects deduction but is only valid within the current scene, it belongs to the Logic Layer, born and dying with the scene. If it affects cross-scene deduction, it belongs to Persistent State and must be saved.

---

## Conclusion

Dual-World Design systematically weaves together engineering paradigms that have been repeatedly validated in other modern domains—ownership control, unidirectional data flow, and event sourcing—into an **Occam's Razor** for slicing game architecture responsibilities.

It provides a mental model of high engineering aesthetics for game development, which has long suffered from mesh structures, callback disasters, and state coupling.
