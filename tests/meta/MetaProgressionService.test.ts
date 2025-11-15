import assert from 'node:assert/strict';
import { RewardCalculator } from '../../src/domain/meta/RewardCalculator';
import { UpgradeEngine } from '../../src/domain/meta/UpgradeEngine';
import { MemoryProgressionStorage, MetaProgressionRepository } from '../../src/domain/meta/MetaProgressionRepository';
import { MetaProgressionService } from '../../src/domain/meta/MetaProgressionService';
import { createDefaultMetaState } from '../../src/domain/meta/MetaProgressionState';
import { SurvivalRunResult } from '../../src/domain/survival/SurvivalModeController';

const rewardCalc = new RewardCalculator();
const upgradeEngine = new UpgradeEngine();
const storage = new MemoryProgressionStorage();
const repository = new MetaProgressionRepository(storage, 'test-meta');
const service = new MetaProgressionService(rewardCalc, upgradeEngine, repository);

(() => {
  const initialState = createDefaultMetaState();
  repository.save(initialState);

  const runResult: SurvivalRunResult = {
    completedWaves: 2,
    playerAlive: false,
    waves: [
      {
        wave: 1,
        enemyId: 'greedy-ghost',
        enemyName: 'Greedy Ghost',
        difficulty: 1,
        rounds: 2,
        victory: true,
        playerHp: 50
      },
      {
        wave: 2,
        enemyId: 'corruptor',
        enemyName: 'Corruptor',
        difficulty: 2,
        rounds: 3,
        victory: true,
        playerHp: 40
      },
      {
        wave: 3,
        enemyId: 'judge-of-void',
        enemyName: 'Judge',
        difficulty: 3,
        rounds: 3,
        victory: false,
        playerHp: 10
      }
    ]
  };

  const { reward, updatedState } = service.processRunResult(initialState, runResult, 60);
  assert.ok(reward.total > 0);
  assert.equal(updatedState.stats.highestWaveReached, 3);
  assert.ok(updatedState.unlockedEnemyIds.includes('corruptor'));
  assert.ok(updatedState.unlockedCardIds.includes('silence-items'));

  const purchasableState = { ...updatedState, currency: updatedState.currency + 200 };
  repository.save(purchasableState);
  const withPurchase = service.purchaseUpgrade(purchasableState, 'maxhp-1');
  assert.ok(withPurchase.purchasedUpgradeIds.includes('maxhp-1'));
  assert.equal(withPurchase.currency, purchasableState.currency - 120);
})();

console.log('MetaProgressionService tests passed.');
