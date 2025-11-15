import { MetaProgressionState } from './MetaProgressionState';
import { RewardCalculator, RewardBreakdown } from './RewardCalculator';
import { UpgradeEngine } from './UpgradeEngine';
import { MetaProgressionRepository } from './MetaProgressionRepository';
import { SurvivalRunResult } from '../survival/SurvivalModeController';
import { waveUnlockRules, enemyDefeatUnlockRules } from '../../content/meta/unlockRules';

export type ProcessRunResult = {
  reward: RewardBreakdown;
  updatedState: MetaProgressionState;
};

export class MetaProgressionService {
  constructor(
    private readonly rewards: RewardCalculator,
    private readonly upgrades: UpgradeEngine,
    private readonly repository: MetaProgressionRepository
  ) {}

  loadState(): MetaProgressionState {
    return this.repository.load();
  }

  saveState(state: MetaProgressionState): void {
    this.repository.save(state);
  }

  processRunResult(
    currentState: MetaProgressionState,
    runResult: SurvivalRunResult,
    playerMaxHp: number
  ): ProcessRunResult {
    const reward = this.rewards.calculate(runResult, playerMaxHp);
    const updatedStats = {
      runsCompleted: currentState.stats.runsCompleted + 1,
      highestWaveReached: Math.max(
        currentState.stats.highestWaveReached,
        runResult.waves.reduce((max, wave) => Math.max(max, wave.wave), 0)
      ),
      totalEnemiesDefeated: currentState.stats.totalEnemiesDefeated + reward.enemiesDefeated,
      totalDataPointsEarned: currentState.stats.totalDataPointsEarned + reward.total
    };

    const defeatCounts = { ...currentState.enemyDefeatCounts };
    for (const wave of runResult.waves) {
      if (wave.victory) {
        defeatCounts[wave.enemyId] = (defeatCounts[wave.enemyId] ?? 0) + 1;
      }
    }

    let unlockedEnemies = [...currentState.unlockedEnemyIds];
    let unlockedCards = [...currentState.unlockedCardIds];

    for (const rule of waveUnlockRules) {
      if (updatedStats.highestWaveReached >= rule.wave) {
        if (rule.enemyId && !unlockedEnemies.includes(rule.enemyId)) {
          unlockedEnemies = [...unlockedEnemies, rule.enemyId];
        }
        if (rule.cardId && !unlockedCards.includes(rule.cardId)) {
          unlockedCards = [...unlockedCards, rule.cardId];
        }
      }
    }

    for (const rule of enemyDefeatUnlockRules) {
      const defeats = defeatCounts[rule.enemyId] ?? 0;
      if (defeats > 0 && rule.cardId && !unlockedCards.includes(rule.cardId)) {
        unlockedCards = [...unlockedCards, rule.cardId];
      }
    }

    const updatedState: MetaProgressionState = {
      ...currentState,
      currency: currentState.currency + reward.total,
      unlockedEnemyIds: unlockedEnemies,
      unlockedCardIds: unlockedCards,
      enemyDefeatCounts: defeatCounts,
      stats: updatedStats
    };

    this.saveState(updatedState);

    return { reward, updatedState };
  }

  purchaseUpgrade(state: MetaProgressionState, upgradeId: string): MetaProgressionState {
    const newState = this.upgrades.purchase(state, upgradeId);
    this.saveState(newState);
    return newState;
  }
}
