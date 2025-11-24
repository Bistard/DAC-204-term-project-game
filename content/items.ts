import { ItemDefinition, ItemType, Item } from '../common/types';

export const PRECISION_PULL_VALUES = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: 'A', value: 11 },
] as const;

export const TARGET_OVERRIDE_VALUES = [18, 24, 27] as const;

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'heal',
    name: 'Heal',
    description: 'Recover 3 HP.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'HEAL',
        scope: 'SELF',
        amount: 3,
      },
    ],
  },
  {
    id: 'block',
    name: 'Block Damage',
    description: 'End of round, block 3 incoming damage.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'RESOLUTION_DAMAGE_BUFFER',
        scope: 'SELF',
        amount: 3,
      },
    ],
  },
  {
    id: 'overload',
    name: 'Overload',
    description: 'End of round, the enemy takes +2 extra damage.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'RESOLUTION_DAMAGE_BOOST',
        scope: 'OPPONENT',
        amount: 2,
      },
    ],
  },
  {
    id: 'lucky_me',
    name: 'I\'m Lucky',
    description: 'Attempt to draw the card that brings you closest to the current target.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'DRAW_OPTIMAL',
      },
    ],
  },
  {
    id: 'swapper',
    name: 'Swapper',
    description: 'Swap the last drawn cards between you and the enemy.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'SWAP_LAST_CARD',
      },
    ],
  },
  {
    id: 'enemy_rollback',
    name: 'Enemy Rollback',
    description: 'Return the enemy\'s last drawn card, shuffling it back into the deck.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'UNDO_LAST_DRAW',
        scope: 'OPPONENT',
      },
    ],
  },
  {
    id: 'self_rollback',
    name: 'Self Rollback',
    description: 'Undo your own last drawn card, shuffling it back into the deck.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'UNDO_LAST_DRAW',
        scope: 'SELF',
      },
    ],
  },
  {
    id: 'replace',
    name: 'Replace',
    description: 'Replace your last card and attempt to draw a new one.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'REPLACE_LAST_CARD',
        scope: 'SELF',
      },
    ],
  },
  {
    id: 'buffer_overflow',
    name: 'Buffer Overflow',
    description: 'Force the opponent to draw a card immediately.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'FORCE_DRAW',
        scope: 'OPPONENT',
      },
    ],
  },
  {
    id: 'take_a_chance',
    name: 'Take a Chance',
    description: 'Draw two random item cards, but suffer 2 damage.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'GAIN_RANDOM_ITEMS',
        scope: 'SELF',
        amount: 2,
      },
      {
        type: 'SELF_DAMAGE',
        scope: 'SELF',
        amount: 2,
      },
    ],
  },
  {
    id: 'immune',
    name: 'Can\'t Hit Me',
    description: 'Become immune to settlement damage this round.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'RESOLUTION_DAMAGE_IMMUNITY',
        scope: 'SELF',
      },
    ],
  },
  {
    id: 'precision_pull',
    name: 'Precision Pull',
    description: 'Attempt to draw a X.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'DRAW_VALUE',
        metadata: { targetValue: 0 },
      },
    ],
  },
  {
    id: 'target_override',
    name: 'Target Override',
    description: 'This round only, set the victory target to X.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'SET_TEMP_TARGET_SCORE',
        amount: TARGET_OVERRIDE_VALUES[0],
      },
    ],
  },
  {
    id: 'chaos',
    name: 'Chaos',
    description: 'Trigger a random item effect and draw 1 item card.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'RANDOM_ITEM_EFFECT',
        metadata: {
          maxRolls: 10,
        }
      },
      {
        type: 'GAIN_RANDOM_ITEMS',
        scope: 'SELF',
        amount: 1,
      },
    ],
  },
  {
    id: 'reckless_scan',
    name: 'Reckless Scan',
    description: 'Draw 1 card. If you do not bust, the round loser suffers +2 damage.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'DRAW',
        cards: 1,
      },
      {
        type: 'PENDING_LOSER_DAMAGE',
        amount: 2,
        metadata: { requireSafeScore: true },
      },
    ],
  },
  {
    id: 'life_siphon',
    name: 'Life Siphon',
    description: 'Drain 1 HP from the opponent and heal yourself for 1 HP.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'LIFE_DRAIN',
        scope: 'OPPONENT',
        amount: 1,
      },
    ],
  },
  {
    id: 'cache_overclock',
    name: 'Cache Overclock',
    description: 'Restore HP equal to the number of item cards you currently hold.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'HEAL_PER_INVENTORY',
        scope: 'SELF',
        metadata: { perItem: 1 },
      },
    ],
  },
];

export const ITEMS: Item[] = ITEM_DEFINITIONS.map(definition => ({
  ...definition,
  instanceId: `${definition.id}-codex`,
}));
