/**
 * @netweave/core public API.
 *
 * The runtime internals stay inside this package; consumers should only import
 * from this entrypoint.
 *
 * Note: resolution building (bundle → steps) is game-layer concern.
 * evt-core only outputs bundles (patches + timeline). How to turn bundles into
 * a UI-facing resolution is up to the game.
 */
export { createEngine } from './Engine.js';
