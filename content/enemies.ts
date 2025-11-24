import { EnemyTemplate } from '../common/types';
import { MAX_INVENTORY_SLOTS } from '../common/constants';

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: 'greedy_ghost',
    name: 'Greedy Ghost',
    difficulty: 1,
    baseHp: 10,
    baseShield: 0,
    aiProfile: 'GREEDY',
    description: 'Hits until 18 or bust.',
    maxInventory: MAX_INVENTORY_SLOTS,
  },
  {
    id: 'script_kiddie',
    name: 'Script Kiddie',
    difficulty: 1,
    baseHp: 10,
    baseShield: 0,
    aiProfile: 'RANDOM',
    description: 'Unpredictable.',
    maxInventory: MAX_INVENTORY_SLOTS,
  },
  {
    id: 'firewall_daemon',
    name: 'Firewall Daemon',
    difficulty: 2,
    baseHp: 12,
    baseShield: 5,
    aiProfile: 'DEFENSIVE',
    description: 'Stands on 16.',
    maxInventory: MAX_INVENTORY_SLOTS,
  },
  {
    id: 'judge_void',
    name: 'Judge of Void',
    difficulty: 3,
    baseHp: 15,
    baseShield: 0,
    aiProfile: 'GREEDY',
    description: 'The Lawmaker.',
    maxInventory: MAX_INVENTORY_SLOTS,
  },
];

export const ENEMIES = ENEMY_TEMPLATES;
