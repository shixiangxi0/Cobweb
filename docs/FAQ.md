## FAQ

### 1. Aren't frame-driven and event-driven the same thing?

> At the lowest level, they are indeed both based on loops. But the difference lies in one being **active polling** and the other **passive response**—and this distinction is enormous.
>
> Frame-driven means you control when to call, actively checking state and advancing logic every frame; event-driven means you hand control over to the event source, and the system only wakes up when something happens.
>
> The latter represents a **decentralized design philosophy**. You might ask: don't Bevy and Unity with ECS also achieve decentralization? Can't they also separate logic from presentation?
>
> Good question. Both are separations, but at **two fundamentally different levels**.
>
> Traditional ECS achieves separation at the **game development level**, where all developers must abide by the same development conventions, mainly:
> - All entities must follow the same structure
> - Dependencies are determined at compile time
>
> Event-driven, on the other hand, achieves separation at the **architectural level**, decoupling sender and receiver through **message passing**, manifesting as a **runtime dynamic binding** collaboration pattern:
> - No need for components to implement any interface; simply register an event handler at runtime, and component behavior can be composed on demand
> - Handlers can carry context, making them extremely convenient for handling local logic. This also provides a very friendly entry point for AI—even the tiniest local events can be made perceptible to AI
> - Compared to traditional interface implementations, the code volume is lower and readability is higher
>
> You might then ask: doesn't this approach have performance issues with CPU/memory optimization and parallel processing?
>
> This is an engineering problem, not a logical flaw—and it is entirely solvable. Event-driven design only decouples localized, data-driven logic; it does not replace per-frame hardware computation. In optimization, these must be separated: for example, high-frequency events can be batched, critical paths can be inlined, and event streams can even be implicitly transformed into deterministic state-machine configurations—all while preserving architectural clarity.
