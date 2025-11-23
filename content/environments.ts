import { EnvironmentCard } from '../types';

export const ENVIRONMENT_CARDS: EnvironmentCard[] = [
  {
    id: 'HighStakes',
    name: 'High Stakes',
    description: 'Damage is doubled this run.',
    effects: [
      {
        type: 'DAMAGE_MULTIPLIER',
        scope: 'BOTH',
        amount: 2,
        duration: 'RUN',
      },
    ],
  },
  {
    id: 'DataLeak',
    name: 'Data Leak',
    description: 'Both players play with 1 card revealed.',
    effects: [
      {
        type: 'FORCE_REVEAL',
        scope: 'BOTH',
        metadata: { visibleCards: 1 },
        duration: 'RUN',
      },
    ],
  },
  {
    id: 'SystemFailure',
    name: 'System Failure',
    description: 'Target score is 17 instead of 21.',
    effects: [
      {
        type: 'SET_TARGET_SCORE',
        amount: 17,
        scope: 'BOTH',
        duration: 'RUN',
      },
    ],
  },
];
