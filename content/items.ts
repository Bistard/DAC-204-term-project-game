import { Item, ItemType, GameState } from '../types';

export const ITEMS: Item[] = [
  {
    id: 'potion_small',
    name: 'Glitch Salve',
    description: 'Recover 3 HP.',
    type: ItemType.CONSUMABLE,
    effect: (state: GameState) => ({
        player: {
            ...state.player,
            hp: Math.min(state.player.maxHp, state.player.hp + 3)
        }
    }),
  },
  {
    id: 'shield_temp',
    name: 'Firewall',
    description: 'Gain 5 Shield.',
    type: ItemType.CONSUMABLE,
    effect: (state: GameState) => ({
        player: {
            ...state.player,
            shield: state.player.shield + 5
        }
    }),
  },
  {
    id: 'reload',
    name: 'Cache Clear',
    description: 'Draw a card.',
    type: ItemType.CONSUMABLE,
    effect: (state: GameState) => {
         // Logic handled in component/context usually, but here we can try to modify state
         // Simple draw logic not easily pure here without side effects of deck manipulation in `hit`.
         // For now, placeholder or needs context support.
         // In this refactor, `useItem` handles logic, this effect return is merged.
         // We'll implement a flag or handle specific ID in context if complex logic needed.
         return {}; 
    },
  },
];
