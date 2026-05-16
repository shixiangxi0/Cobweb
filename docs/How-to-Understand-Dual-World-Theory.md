# How to Understand Dual-World Theory

This document aims to provide an "architecture reference" to help developers familiar with modern software engineering build intuition for the Dual-World architecture.

---

## 1. Causality and State: The Game Mapping of Event Sourcing and CQRS

Traditional game engines are mostly "State-Driven," treating in-memory variables as the truth of the world. In Dual-World Theory, **"causality is the fact, and state is merely a projection."**

This corresponds to **Event Sourcing** and **Command Query Responsibility Segregation (CQRS)** in serious software engineering:

* **Game Causality (Event / Write Model)**: Player button presses, collision-triggered damage—these are absolutely immutable "event facts" of the system. The logic engine is an absolutely serial processing pipeline, computing and accumulating the core ledger of the World Causality Tree through one-way reduction (Reduce) of these events.
* **Perceptual Causality (Projection / Read Model)**: Animations, effects, and particles in the presentation layer are essentially "read/projection models" derived by the engine from the event stream. They are separated onto another axis, dedicated to optimizing continuous audio-visual feedback for humans. Because they are merely projections, they can naturally be erased at any time and recalculated based on causality.

---

## 2. Three Layers of Sovereignty: Borrow Checker and Scope

The three layers of sovereignty in Dual-World Theory are structurally isomorphic to Rust's ownership model:

* **World Causality Tree (unique mutable borrow `&mut T`)**
  The core state tree is held with write permission by the logic layer at all times; all state evolution is strictly serial. This is not a convention but a structural constraint—races cannot occur at the architectural level, for the same reason Rust does not allow two `&mut T` to exist simultaneously.

* **Local Causality (Delegated Sovereignty / Scope of `&mut T`)**
  The World Causality Tree delegates power to the current scene; all state deduction within the scene happens in Local Causality. When the scene ends, the delegated sovereignty is revoked and local state is destroyed entirely—completely corresponding to Rust's mechanism where variables are automatically dropped when they leave scope.

* **Presentation Runtime (immutable borrow `&T`)**
  The presentation layer only holds read permission for logic snapshots. How long an animation plays, whether it is forcibly interrupted, or even if the entire rendering layer crashes—none of these can affect the logic state in reverse. Multiple rendering components can read the same snapshot simultaneously, for the same reason Rust allows multiple `&T` to exist: read-only does not produce contention.

* **Temporal Causal Sovereignty (lifetime `'a`)**
  The time that Local Causality holds temporary states is bounded. When the window closes or is preempted by an upper layer, temporary states are directly destroyed without manual cleanup and leave no residue—completely corresponding to Rust's mechanism where variables are automatically dropped when they leave scope. The difference is that Rust's lifetimes are statically determined at compile time, while Temporal Causal Sovereignty windows are dynamically granted and revoked at runtime.

---

## 3. Rendering Autonomy: Unidirectional Data Flow and UI Local State

"Rendering components hold presentation but not logic"—at first this sounds like a paradox: if a monster component can judge distance and run toward the player on its own, how can it have no business logic?

To understand the subtlety of this isolation, consider **modern frontend component governance design (such as the React + Redux/Flux paradigm)**:

* **Local State of Presentation Components (Local Simulation Autonomy)**:
  In frontend architecture, we would never put "the intermediate value of a dropdown expansion animation" or "a button's hover gradient" into an application-level Redux Store. By the same token, rendering components can internally maintain highly complex physical displacement simulations and pathfinding interpolation (this is their Local UI State) to ensure screen responsiveness. But these computations are strictly confined to the visual presentation layer and do not serve as the truth of the world.
* **Core Validation Global Store (Unidirectional Data Flow)**:
  No matter what a rendering component independently calculates internally, as long as it does not throw (Dispatch) a key event upward, it will not affect the causal direction of the business. Only when the rendering component detects and confirms substantive contact does it fire a discrete safe payload (Event Payload) to the Local Causality system.

This separation of powers isolates high-frequency, continuous, noise-filled "perceptual simulation" at the periphery, ensuring the purity of the core engine (Reducer) and the absolute determinism of deduction.

> Generally, developers first encountering the Dual-World architecture tend to treat all player input as processing from the presentation layer to Local Causality. This is wrong. You must map each player input to its associated three-layer structure at the design stage: if it belongs to rendering components, it is autonomous by default and disposable. If it affects deduction but is only valid within the current scene, it belongs to Local Causality, born and dying with the scene. If it affects cross-scene deduction, it belongs to the World Causality Tree and must be persisted.

---

## Conclusion

Dual-World Theory systematically weaves together engineering paradigms that have been repeatedly validated in other modern domains—ownership control, unidirectional data flow, and event sourcing—into an **Occam's Razor** for slicing game architecture responsibilities.

It provides a mental model of high engineering aesthetics for game development, which has long suffered from mesh structures, callback disasters, and state coupling.
