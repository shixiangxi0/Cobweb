/**
 * render/shared/content/i18n/en.js — English display text overlay
 *
 * Purely supplementary: missing entries fall back to base content automatically.
 * Structure mirrors content catalog display fields in cards / statuses / enemies.
 */
export default {
  cards: {
    strike:      { name: 'Strike',        desc: 'Deal 6 damage.' },
    defend:      { name: 'Defend',        desc: 'Gain 5 Block.' },
    bash:        { name: 'Bash',          desc: 'Deal 8 damage. Apply 2 Vulnerable.' },
    iron_wave:   { name: 'Iron Wave',     desc: 'Gain 5 Block. Deal 5 damage.' },
    whirlwind:   { name: 'Whirlwind',     desc: 'Deal Xx5 damage to ALL enemies (X = energy spent).' },
    anger:       { name: 'Anger',         desc: 'Deal 6 damage. Add a copy of Anger to your discard pile.' },
    shrug:       { name: 'Shrug It Off',  desc: 'Gain 8 Block. Draw 1 card.' },
    mulligan:    { name: 'Mulligan',      desc: 'Discard the rest of your hand. Draw that many cards.' },
    inflame:     { name: 'Inflame',       desc: 'Gain 2 Strength.' },
    curiosity:   { name: 'Curiosity',     desc: 'When drawn, gain 1 Strength. Play: discard a random card.' },
    arcane_flux: { name: 'Arcane Flux',   desc: 'Draw 1 additional card at the start of each turn.' },
    offering:    { name: 'Offering',      desc: 'Lose 6 HP. Gain 3 Energy. Draw 3 cards.' },
    rupture:     { name: 'Rupture',       desc: 'Whenever you lose HP directly, gain 1 Strength. Exhaust.' },
    limit_break: { name: 'Limit Break',   desc: 'Double your Strength. Exhaust.' },
    body_slam:   { name: 'Body Slam',     desc: 'Deal damage equal to your current Block.' },
    demon_form:  { name: 'Demon Form',    desc: 'Gain 3 Strength at the start of each turn. Exhaust.' },
    shockwave:   { name: 'Shockwave',     desc: 'Deal 6 damage to ALL enemies. Apply 3 Weak to each. Exhaust.' },
    cleave:      { name: 'Cleave',        desc: 'Deal 8 damage to ALL enemies.' },
    reaper:      { name: 'Reaper',        desc: 'Deal 4 damage to ALL enemies. Heal HP equal to unblocked damage dealt. Exhaust.' },
    entrench:    { name: 'Entrench',      desc: 'Double your current Block.' },
  },
  statuses: {
    block:       { name: 'Block',         desc: 'Absorbs incoming damage. Cleared at start of turn.' },
    strength:    { name: 'Strength',      desc: 'Attacks deal additional damage equal to stacks.' },
    weak:        { name: 'Weak',          desc: 'Attacks deal 25% less damage.' },
    vulnerable:  { name: 'Vulnerable',    desc: 'Takes 50% more damage from attacks.' },
    ritual:      { name: 'Ritual',        desc: 'Gain Strength at the end of each turn equal to stacks.' },
    extra_draw:  { name: 'Extra Draw',    desc: 'Draw additional cards at start of turn equal to stacks.' },
    card_tax:    { name: 'Curse Tax',     desc: 'Whenever you play a card, take damage equal to stacks.' },
    rupture:     { name: 'Rupture',       desc: 'Whenever you lose HP directly, gain Strength equal to stacks.' },
    demon_form:  { name: 'Demon Form',    desc: 'Gain 3 Strength at the start of each turn.' },
    poison:      { name: 'Poison',        desc: 'At end of turn, take damage equal to stacks, then reduce by 1.' },
    thorns:      { name: 'Thorns',        desc: 'When attacked, deal damage equal to stacks back to the attacker.' },
    frail:       { name: 'Frail',         desc: 'Block gained is reduced by 25%.' },
    metallicize: { name: 'Metallicize',   desc: 'Gain Block at the end of each turn equal to stacks.' },
    frenzy:      { name: 'Frenzy',        desc: 'On kill: draw cards equal to stacks and gain 1 Energy.' },
  },
  enemies: {
    jaw_worm: {
      name: 'Jaw Worm',
      actions: {
        bite: 'Deal 11 damage.',
        thrash: 'Deal 7 damage. Gain 3 Strength.',
        bellow: 'Gain 6 Block. Gain 3 Strength.',
      },
    },
    cultist: {
      name: 'Cultist',
      actions: {
        incantation: 'Apply 3 Ritual (gain 3 Strength each turn).',
        dark_strike: 'Deal 6 damage.',
      },
    },
    louse_red: {
      name: 'Red Louse',
      actions: {
        bite: 'Deal 6 damage.',
        grow: 'Gain 3 Strength.',
      },
    },
    louse_green: {
      name: 'Green Louse',
      actions: {
        bite: 'Deal 6 damage.',
        spit: 'Apply 1 Weak.',
      },
    },
    curse_weaver: {
      name: 'Curse Weaver',
      actions: {
        shadow_strike: 'Deal 18 damage.',
        voodoo: 'Apply 2 Vulnerable and 2 Weak.',
        rejuvenate: 'Gain 24 Block. Strengthen Curse Tax (+1 stack).',
        slam: 'Deal 28 damage.',
        curse_nova: 'Curse Tax +3 stacks. Deal 10 damage.',
      },
    },
    iron_golem: {
      name: 'Iron Golem',
      actions: {
        slam: 'Deal 20 damage.',
        fortify: 'Gain 4 Strength.',
        rend: 'Deal 14 damage. Apply 2 Vulnerable.',
        obliterate: 'Deal 30 damage!',
      },
    },
    plague_mage: {
      name: 'Plague Mage',
      actions: {
        infect: 'Apply 5 Poison.',
        plague: 'Deal 10 damage. Apply 5 Poison.',
        virulence: 'Apply 7 Poison and 2 Frail.',
      },
    },
  },
};
