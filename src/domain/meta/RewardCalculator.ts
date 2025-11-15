import { SurvivalRunResult } from '../survival/SurvivalModeController';

export type RewardBreakdown = {
  wavesCleared: number;
  enemiesDefeated: number;
  highestWave: number;
  healthBonus: number;
  total: number;
};

export type RewardCalculatorConfig = {
  waveValue: number;
  enemyValue: number;
  healthValue: number;
};

const DEFAULT_CONFIG: RewardCalculatorConfig = {
  waveValue: 40,
  enemyValue: 30,
  healthValue: 20
};

export class RewardCalculator {
  constructor(private readonly config: RewardCalculatorConfig = DEFAULT_CONFIG) {}

  calculate(runResult: SurvivalRunResult, playerMaxHp: number): RewardBreakdown {
    const wavesCleared = runResult.waves.filter((wave) => wave.victory).length;
    const enemiesDefeated = wavesCleared;
    const highestWave = runResult.waves.reduce((max, wave) => Math.max(max, wave.wave), 0);
    const finalHp = runResult.waves.length > 0 ? runResult.waves[runResult.waves.length - 1].playerHp : playerMaxHp;
    const healthRatio = playerMaxHp > 0 ? Math.max(0, finalHp) / playerMaxHp : 0;
    const healthBonus = Math.round(healthRatio * this.config.healthValue);

    const total =
      wavesCleared * this.config.waveValue + enemiesDefeated * this.config.enemyValue + healthBonus;

    return {
      wavesCleared,
      enemiesDefeated,
      highestWave,
      healthBonus,
      total
    };
  }
}
