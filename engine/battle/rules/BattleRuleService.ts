import { EnvironmentCard, PenaltyCard } from '../../../common/types';
import { IRoundResult } from '../../state/results';
import { BattleRuleState, createDefaultBattleRuleState } from './BattleRuleState';
import { IBattleRuleService, IRoundRuleContext } from './IBattleRuleService';

/**
 * Placeholder implementation used during Stage 2 to satisfy the new contract.
 * The real logic still lives in the legacy services and will be migrated in
 * later phases.
 */
export class BattleRuleService implements IBattleRuleService {
    initialize(_cards: EnvironmentCard[], _penalty: PenaltyCard | null): BattleRuleState {
        return createDefaultBattleRuleState();
    }

    applyRoundResult(_result: IRoundResult, state: BattleRuleState): BattleRuleState {
        return state;
    }

    createRoundContext(state: BattleRuleState): IRoundRuleContext {
        return {
            targetScore: state.targetScoreOverride ?? 0,
            autoDrawPerActor: state.autoDrawPerActor,
            itemUsageLocked: state.itemUsageLocked,
        };
    }
}
