import { AbilityCardDefinition } from '../../domain/cards/CardTypes';
import { getAbilityCardsById } from '../cards/abilityCards';

export type EnemyStrategyDefinition = {
  type: 'threshold';
  standThreshold: number;
  cardPlayThreshold?: number;
};

export type EnemyBehaviorDefinition =
  | { kind: 'none' }
  | { kind: 'corruptCard' }
  | { kind: 'swapFirstCard' };

export type EnemyDefinition = {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  baseAttack: number;
  unlockWave: number;
  difficulty: number;
  strategy: EnemyStrategyDefinition;
  abilityCardIds: string[];
  behaviors?: EnemyBehaviorDefinition[];
};

export const enemyDefinitions: EnemyDefinition[] = [
  {
    id: 'greedy-ghost',
    name: 'Greedy Ghost',
    description: 'Draws aggressively to chase 18+ totals and punishes busts with heavy damage.',
    maxHp: 45,
    baseAttack: 12,
    unlockWave: 1,
    difficulty: 1,
    strategy: { type: 'threshold', standThreshold: 18, cardPlayThreshold: 15 },
    abilityCardIds: ['hex-force-draw', 'tune-plus-one']
  },
  {
    id: 'corruptor',
    name: 'Corruptor',
    description: 'Rots your cards into weak husks each round before attacking.',
    maxHp: 55,
    baseAttack: 11,
    unlockWave: 2,
    difficulty: 2,
    strategy: { type: 'threshold', standThreshold: 17, cardPlayThreshold: 16 },
    abilityCardIds: ['silence-items', 'tune-minus-one'],
    behaviors: [{ kind: 'corruptCard' }]
  },
  {
    id: 'judge-of-void',
    name: 'Judge of the Void',
    description: 'Swaps the first visible card every round to unbalance you.',
    maxHp: 65,
    baseAttack: 13,
    unlockWave: 3,
    difficulty: 3,
    strategy: { type: 'threshold', standThreshold: 17, cardPlayThreshold: 14 },
    abilityCardIds: ['mirror-swap', 'void-limit'],
    behaviors: [{ kind: 'swapFirstCard' }]
  }
];

export const getEnemyDefinition = (id: string): EnemyDefinition | undefined =>
  enemyDefinitions.find((def) => def.id === id);

export const getAbilityCardsForEnemy = (ids: string[]): AbilityCardDefinition[] => getAbilityCardsById(ids);
