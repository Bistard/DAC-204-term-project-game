export type MetaProgressionState = {
  version: number;
  currency: number;
  unlockedCardIds: string[];
  unlockedEnemyIds: string[];
  purchasedUpgradeIds: string[];
  enemyDefeatCounts: Record<string, number>;
  stats: {
    runsCompleted: number;
    highestWaveReached: number;
    totalEnemiesDefeated: number;
    totalDataPointsEarned: number;
  };
};

export const createDefaultMetaState = (): MetaProgressionState => ({
  version: 1,
  currency: 0,
  unlockedCardIds: ['tune-plus-one', 'tune-minus-one', 'guardian-wall'],
  unlockedEnemyIds: ['greedy-ghost'],
  purchasedUpgradeIds: [],
  enemyDefeatCounts: {},
  stats: {
    runsCompleted: 0,
    highestWaveReached: 0,
    totalEnemiesDefeated: 0,
    totalDataPointsEarned: 0
  }
});
