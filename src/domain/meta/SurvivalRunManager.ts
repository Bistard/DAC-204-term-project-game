import { HeroBuilder } from './HeroBuilder';
import { MetaProgressionService } from './MetaProgressionService';
import { SurvivalModeController, SurvivalOptions, SurvivalRunResult } from '../survival/SurvivalModeController';
import { MetaProgressionState } from './MetaProgressionState';

export type SurvivalRunResponse = {
  runResult: SurvivalRunResult;
  rewardTotal: number;
  updatedState: MetaProgressionState;
};

export class SurvivalRunManager {
  constructor(
    private readonly heroBuilder: HeroBuilder,
    private readonly survivalController: SurvivalModeController,
    private readonly progressionService: MetaProgressionService
  ) {}

  run(state: MetaProgressionState, options: SurvivalOptions = {}): SurvivalRunResponse {
    const player = this.heroBuilder.build(state);

    const runResult = this.survivalController.run(player, {
      ...options,
      unlockedEnemyIds: state.unlockedEnemyIds
    });

    const processResult = this.progressionService.processRunResult(state, runResult, player.maxHp);

    return {
      runResult,
      rewardTotal: processResult.reward.total,
      updatedState: processResult.updatedState
    };
  }
}
