import { ItemDefinition, ItemType, Item } from '../types';

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'potion_small',
    name: 'Glitch Salve',
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
    id: 'shield_temp',
    name: 'Firewall',
    description: 'Gain 5 Shield.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'SHIELD',
        scope: 'SELF',
        amount: 5,
      },
    ],
  },
  {
    id: 'reload',
    name: 'Cache Clear',
    description: 'Draw a card.',
    type: ItemType.CONSUMABLE,
    effects: [
      {
        type: 'DRAW',
        scope: 'SELF',
        cards: 1,
      },
    ],
  },
];

export const ITEMS: Item[] = ITEM_DEFINITIONS.map(definition => ({
  ...definition,
  instanceId: `${definition.id}-codex`,
}));
