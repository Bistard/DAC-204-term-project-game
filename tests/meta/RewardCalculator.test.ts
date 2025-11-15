import assert from 'node:assert/strict';
import { RewardCalculator } from '../../src/domain/meta/RewardCalculator';
import { SurvivalRunResult } from '../../src/domain/survival/SurvivalModeController';

const calculator = new RewardCalculator();

(() => {
  const runResult: SurvivalRunResult = {
    completedWaves: 2,
    playerAlive: true,
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
        victory: false,
        playerHp: 20
      }
    ]
  };

  const reward = calculator.calculate(runResult, 60);
  assert.equal(reward.highestWave, 2);
  assert.equal(reward.wavesCleared, 1);
  assert.equal(reward.enemiesDefeated, 1);
  assert.ok(reward.total > 0);
})();

console.log('RewardCalculator tests passed.');
