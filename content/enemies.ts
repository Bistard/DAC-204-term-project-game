import { Enemy } from '../types';
import { MAX_INVENTORY_SLOTS } from '../constants';

export const ENEMIES: Enemy[] = [
  {
    id: 'greedy_ghost',
    name: 'Greedy Ghost',
    difficulty: 1,
    hp: 10,
    maxHp: 10,
    hand: [],
    score: 0,
    shield: 0,
    aiType: 'GREEDY',
    description: 'Hits until 18 or bust.',
    inventory: [],
    maxInventory: MAX_INVENTORY_SLOTS
  },
  {
    id: 'script_kiddie',
    name: 'Script Kiddie',
    difficulty: 1,
    hp: 10,
    maxHp: 10,
    hand: [],
    score: 0,
    shield: 0,
    aiType: 'RANDOM',
    description: 'Unpredictable.',
    inventory: [],
    maxInventory: MAX_INVENTORY_SLOTS
  },
  {
    id: 'firewall_daemon',
    name: 'Firewall Daemon',
    difficulty: 2,
    hp: 12,
    maxHp: 12,
    hand: [],
    score: 0,
    shield: 5,
    aiType: 'DEFENSIVE',
    description: 'Stands on 16.',
    inventory: [],
    maxInventory: MAX_INVENTORY_SLOTS
  },
  {
    id: 'judge_void',
    name: 'Judge of Void',
    difficulty: 3,
    hp: 15,
    maxHp: 15,
    hand: [],
    score: 0,
    shield: 0,
    aiType: 'GREEDY',
    description: 'The Lawmaker.',
    inventory: [],
    maxInventory: MAX_INVENTORY_SLOTS
  },
];