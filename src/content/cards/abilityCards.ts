import { AbilityCardDefinition } from '../../domain/cards/CardTypes';

export const abilityCardDefinitions: AbilityCardDefinition[] = [
  {
    id: 'tune-plus-one',
    name: 'Precision Tune',
    type: 'skill',
    rarity: 'common',
    description: 'Increase your total by +1.',
    effects: [
      {
        kind: 'adjustTotal',
        amount: 1,
        target: 'self'
      }
    ],
    tags: ['number-manipulation']
  },
  {
    id: 'tune-minus-one',
    name: 'Stutter Step',
    type: 'skill',
    rarity: 'common',
    description: 'Reduce your total by 1 to avoid a bust.',
    effects: [
      {
        kind: 'adjustTotal',
        amount: -1,
        target: 'self'
      }
    ],
    tags: ['number-manipulation']
  },
  {
    id: 'ace-transmute',
    name: 'Ace Transmute',
    type: 'skill',
    rarity: 'rare',
    description: 'Convert your highest-value card into an Ace.',
    effects: [
      {
        kind: 'convertToAce',
        target: 'self'
      }
    ],
    tags: ['number-manipulation']
  },
  {
    id: 'tactical-peek',
    name: 'Tactical Peek',
    type: 'item',
    rarity: 'common',
    description: 'Peek at the next two cards in the deck.',
    effects: [
      {
        kind: 'peekNext',
        count: 2
      }
    ],
    tags: ['draw-manipulation']
  },
  {
    id: 'hex-force-draw',
    name: 'Hex Draw',
    type: 'item',
    rarity: 'rare',
    description: 'Force the opponent to draw a card immediately.',
    effects: [
      {
        kind: 'forceDraw',
        target: 'opponent'
      }
    ],
    tags: ['draw-manipulation']
  },
  {
    id: 'mirror-swap',
    name: 'Mirror Swap',
    type: 'skill',
    rarity: 'rare',
    description: 'Swap the first visible card between both hands.',
    effects: [
      {
        kind: 'swapFirstCard'
      }
    ],
    tags: ['draw-manipulation']
  },
  {
    id: 'rupture-strike',
    name: 'Rupture Strike',
    type: 'item',
    rarity: 'common',
    description: 'Deal 6 direct damage to the enemy.',
    effects: [
      {
        kind: 'directDamage',
        amount: 6,
        target: 'opponent'
      }
    ],
    tags: ['attack']
  },
  {
    id: 'guardian-wall',
    name: 'Guardian Wall',
    type: 'item',
    rarity: 'common',
    description: 'Gain a shield that blocks 8 damage.',
    effects: [
      {
        kind: 'addShield',
        amount: 8
      }
    ],
    tags: ['defense']
  },
  {
    id: 'void-limit',
    name: 'Void Threshold',
    type: 'rule',
    rarity: 'epic',
    description: 'Set the target limit to 24 for this round.',
    effects: [
      {
        kind: 'setTargetLimit',
        limit: 24
      }
    ],
    tags: ['rule-change']
  },
  {
    id: 'silence-items',
    name: 'Silence Field',
    type: 'rule',
    rarity: 'rare',
    description: 'Prevent the opponent from playing item cards this round.',
    effects: [
      {
        kind: 'restrictCardType',
        cardType: 'item',
        target: 'opponent'
      }
    ],
    tags: ['rule-change']
  }
];

export const getAbilityCardById = (id: string): AbilityCardDefinition | undefined =>
  abilityCardDefinitions.find((card) => card.id === id);

export const getAbilityCardsById = (ids: string[]): AbilityCardDefinition[] =>
  ids
    .map((id) => getAbilityCardById(id))
    .filter((card): card is AbilityCardDefinition => Boolean(card));
