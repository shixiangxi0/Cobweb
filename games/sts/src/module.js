/**
 * games/sts/src/module.js — STS game module
 *
 * Assembles all STS content into a single Module object that can be passed to
 * engine.use(). The evt/ engine has no knowledge of STS; everything STS
 * "knows" lives here.
 *
 * Usage:
 *   import { createEngine } from '@netweave/core'
 *   import { stsModule }    from './index.js'
 *
 *   const engine = await createEngine({ onBundle })
 *   engine.use(stsModule)
 *   engine.load(buildBattleStore(scenario))
 *   engine.state.emit('battle:start', {})
 *
 * Module structure:
 *   events      — every event slot STS uses (from engine/definitions/events.js)
 *   rules       — all static rules: universal game mechanics + STS-specific rules
 *   defs        — card / status / enemy definition objects (looked up by State.bind)
 *
 * Nothing in this file creates engine instances or knows how the engine works
 * internally. It only describes WHAT the game needs.
 */

// ── Event declarations ───────────────────────────────────────────────────────
export const EVENTS = {
  'entity:attack':     { action: 'ENTITY_ATTACK'      },
  'entity:damage':     { action: 'ENTITY_DAMAGE'      },
  'entity:heal':       { action: 'ENTITY_HEAL'        },
  'entity:block':      { action: 'ENTITY_BLOCK'       },
  'entity:loss':       { action: 'ENTITY_LOSS'        },
  'entity:die':        { action: 'ENTITY_DIE'         },
  'enemy:die':         { action: 'ENEMY_DIE'          },
  'enemy:action':      { action: 'ENEMY_ACTION'       },
  'enemy:update':      { action: 'ENEMY_UPDATE'       },
  'card:play':         { action: 'CARD_PLAY'          },
  'card:effect':       { action: 'CARD_EFFECT'        },
  'card:draw':         { action: 'CARD_DRAW'          },
  'card:discard':      { action: 'CARD_DISCARD'       },
  'card:exhaust':      { action: 'CARD_EXHAUST'       },
  'card:move':         { action: 'CARD_MOVE'          },
  'card:system:move':  { action: 'CARD_SYSTEM_MOVE'   },
  'status:apply':      { action: 'STATUS_APPLY'       },
  'status:remove':     { action: 'STATUS_REMOVE'      },
  'player:turn:start': { action: 'PLAYER_TURN_START'  },
  'player:turn:end':   { action: 'PLAYER_TURN_END'    },
  'actor:turn:start':  { action: 'ACTOR_TURN_START'   },
  'actor:turn:end':    { action: 'ACTOR_TURN_END'     },
  'turn:end':          { action: 'TURN_END'           },
  'battle:start':      { action: 'BATTLE_START'       },
  'battle:end':        { action: 'BATTLE_END'         },
  'flow:victory':      { action: 'FLOW_VICTORY'       },
  'flow:defeat':       { action: 'FLOW_DEFEAT'        },
  'flow:advance':      { action: 'FLOW_ADVANCE'       },
  'defeat:enter':      { action: 'DEFEAT_ENTER'       },
  'deck:deplete':      { action: 'DECK_DEPLETE'       },
  'card:create':       { action: 'CARD_CREATE'        },
  'run:player:sync':   { action: 'RUN_PLAYER_SYNC'    },
  'shop:enter':        { action: 'SHOP_ENTER'         },
  'shop:leave':        { action: 'SHOP_LEAVE'         },
  'shop:buy':          { action: 'SHOP_BUY'           },
  'shop:stock:updated':{ action: 'SHOP_STOCK_UPDATED' },
  'reward:open':       { action: 'REWARD_OPEN'        },
  'reward:claim':      { action: 'REWARD_CLAIM'       },
  'reward:skip':       { action: 'REWARD_SKIP'        },
  'relic:acquire':     { action: 'RELIC_ACQUIRE'      },
  'phase:enter':       { action: 'PHASE_ENTER'        },
  'debug:addGold':     { action: 'DEBUG_ADD_GOLD'     },
  'debug:resetBattle': { action: 'DEBUG_RESET_BATTLE' },
  'debug:killAllEnemies': { action: 'DEBUG_KILL_ALL_ENEMIES' },
};

// ── Rules ────────────────────────────────────────────────────────────────────
import { ALL_RULES } from './rules/index.js'
import { shuffleTrackerCore } from './content/cards/hook_driven.js'
// (phaseEnterCore now lives in rules/flow.js and is included via ALL_RULES)
import {
  CONTEXT_INHERITANCE,
  CONTEXT_INHERITANCE_MAP,
  DEFAULT_MATCH_BY_KIND,
  REQUIRED_CTX,
} from './bindings/config.js'

// ── Definition data ──────────────────────────────────────────────────────────
import * as ironcladCards  from './content/cards/ironclad.js'
import * as hookCards      from './content/cards/hook_driven.js'
import * as statusDefs     from './content/statuses/core.js'
import * as enemyDefs      from './content/enemies/index.js'
import * as hookEnemies    from './content/enemies/hook_driven.js'
import * as relicDefs      from './content/relics.js'

// ── Assemble the module ───────────────────────────────────────────────────────

/**
 * Helper: convert an array of definition objects keyed by `id` into a lookup map.
 * e.g. [{ id: 'strike', ... }, { id: 'defend', ... }]  →  { strike: {...}, defend: {...} }
 *
 * @param {object[]} arr
 * @returns {Record<string, object>}
 */
function byId(arr) {
  return Object.fromEntries(arr.map(d => [d.id, d]))
}

const cardDefs = byId([...Object.values(ironcladCards), ...Object.values(hookCards)])

export const stsModule = {
  // Every event that STS rules or scripts may emit must be declared here.
  events: EVENTS,

  contextInheritance: CONTEXT_INHERITANCE,
  contextInheritanceMap: CONTEXT_INHERITANCE_MAP,
  defaultMatchByKind: DEFAULT_MATCH_BY_KIND,
  requiredCtx: REQUIRED_CTX,

  // Static rules are registered once at engine.use() time and never cleared.
  // Order within this array doesn't affect execution order — only trigger.order does.
  rules: [...ALL_RULES, shuffleTrackerCore],

  // Definition data, keyed by kind then id.
  // Cards / statuses / enemies all expose unified `hooks{}` event handlers.
  // Enemies additionally carry `actions{}` for pure UI intent display.
  defs: {
    card:       cardDefs,
    status:     byId(Object.values(statusDefs)),
    enemy:      byId([...Object.values(enemyDefs), ...Object.values(hookEnemies)]),
    relic:      byId(Object.values(relicDefs)),
  },
}
