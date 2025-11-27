import { EnvironmentCard, PenaltyCard } from '../../../common/types';
import { IRoundResult } from '../../state/results';
import { BattleRuleState } from './BattleRuleState';

export interface IRoundRuleContext {
    targetScore: number;
    autoDrawPerActor: number;
    itemUsageLocked: boolean;
}

export interface IBattleRuleService {
    initialize(cards: EnvironmentCard[], penalty: PenaltyCard | null): BattleRuleState;
    applyRoundResult(result: IRoundResult, state: BattleRuleState): BattleRuleState;
    createRoundContext(state: BattleRuleState): IRoundRuleContext;
}
